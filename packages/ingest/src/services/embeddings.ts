import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";

/** Includes the pinned upstream model revision and every vector-producing setting. */
export const EMBEDDING_MODEL_ID =
  "encoders-3.1.0/bekko-static-v1-slim-100k@635eb094a82ce43f0eb882c12b31406b3d93ec26/mrl512-int8-mean-v1";
export const EMBEDDING_DIMENSIONS = 512;
const MAX_INPUT_BYTES = 262_144;
const OUTPUT_BYTES = EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT;
const encoder = new TextEncoder();

type EncoderExports = {
  memory: WebAssembly.Memory;
  dimensions: () => number;
  revision_pointer: () => number;
  revision_length: () => number;
  element_bytes: () => number;
  allocate: (length: number) => number;
  release: (pointer: number, length: number) => void;
  encode: (input: number, length: number, output: number, outputLength: number) => number;
};

let runtime: Promise<EncoderExports> | undefined;

function loadEncoder(): Promise<EncoderExports> {
  runtime ??= readFile(new URL("../../encoders/dist/kyomi_encoders.wasm", import.meta.url))
    .then((bytes) => WebAssembly.instantiate(bytes))
    .then(({ instance }) => {
      const exports = instance.exports as unknown as EncoderExports;
      if (exports.dimensions() !== EMBEDDING_DIMENSIONS) {
        throw new Error("Compiled encoder dimensions do not match the configured model");
      }
      const revision = new TextDecoder().decode(
        new Uint8Array(
          exports.memory.buffer,
          exports.revision_pointer(),
          exports.revision_length(),
        ),
      );
      if (
        revision !== "635eb094a82ce43f0eb882c12b31406b3d93ec26" ||
        exports.element_bytes() !== 1
      ) {
        throw new Error(
          "Compiled encoder model revision or quantization does not match configuration",
        );
      }
      return exports;
    })
    .catch((cause: unknown) => {
      runtime = undefined;
      throw new Error(
        "Local embeddings unavailable; run bun run --cwd packages/ingest embeddings:build",
        {
          cause,
        },
      );
    });
  return runtime;
}

/**
 * Server-only raw pooled vectors, matching the pinned upstream model (NORMALIZE=false).
 * Use cosine similarity or L2-normalize before dot-product retrieval. The category head already
 * normalizes its inputs. No network, credentials, runtime model download, or subprocess.
 */
export async function encodeTexts(texts: readonly string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const wasm = await loadEncoder();
  const vectors: number[][] = [];
  // Bound each synchronous slice so bulk backfills yield to requests and other jobs.
  for (const text of texts) {
    // UTF-8 needs at least one byte per UTF-16 code unit; reject huge inputs before allocation.
    if (text.length > MAX_INPUT_BYTES) {
      throw new Error(`Embedding input exceeds ${MAX_INPUT_BYTES} UTF-8 bytes`);
    }
    const bytes = encoder.encode(text);
    if (bytes.length > MAX_INPUT_BYTES) {
      throw new Error(`Embedding input exceeds ${MAX_INPUT_BYTES} UTF-8 bytes`);
    }
    const inputLength = Math.max(1, bytes.length);
    const input = wasm.allocate(inputLength);
    const output = wasm.allocate(OUTPUT_BYTES);
    try {
      if (!input || !output) {
        throw new Error("Local encoder allocation failed");
      }
      new Uint8Array(wasm.memory.buffer, input, bytes.length).set(bytes);
      if (wasm.encode(input, bytes.length, output, OUTPUT_BYTES) !== 0) {
        throw new Error("Local encoder rejected the input");
      }
      // Copy before releasing memory; WASM growth can also invalidate previous views.
      const vector = Array.from(new Float32Array(wasm.memory.buffer, output, EMBEDDING_DIMENSIONS));
      if (!vector.every(Number.isFinite)) {
        throw new Error("Local encoder produced a non-finite vector");
      }
      vectors.push(vector);
    } finally {
      wasm.release(input, inputLength);
      wasm.release(output, OUTPUT_BYTES);
    }
    await setImmediate();
  }
  return vectors;
}
