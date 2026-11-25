import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { EMBEDDING_CLASSIFIER_MODEL_ID, embedTexts } from "@kyomi/ingest";

/** Offline, model-scoped vectors for repeatable local classifier sweeps. */
const REPO_ROOT = resolve(import.meta.dir, "../../../../../..");
type EmbeddingsCacheFile = Record<string, string>;

function textKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function encodeVector(vector: readonly number[]): string {
  return Buffer.from(new Float32Array(vector).buffer).toString("base64");
}

function decodeVector(encoded: string): number[] {
  const bytes = Buffer.from(encoded, "base64");
  return Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
}

export function embeddingsCacheFile(name: string): string {
  const modelDir = EMBEDDING_CLASSIFIER_MODEL_ID.replace(/[^a-z0-9.-]+/gi, "_");
  return join(REPO_ROOT, ".artifacts", "embeddings", modelDir, `${name}.json`);
}

/** Fill misses with the same local encoder used in production; never call a remote provider. */
export function cachedEmbeddings(cacheFile: string) {
  const cache: EmbeddingsCacheFile = existsSync(cacheFile)
    ? (JSON.parse(readFileSync(cacheFile, "utf8")) as EmbeddingsCacheFile)
    : {};
  return async (texts: readonly string[]): Promise<number[][]> => {
    const misses = [...new Set(texts.filter((text) => !(textKey(text) in cache)))];
    if (misses.length > 0) {
      const vectors = await embedTexts(misses);
      misses.forEach((text, index) => {
        cache[textKey(text)] = encodeVector(vectors[index]!);
      });
      mkdirSync(dirname(cacheFile), { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(cache));
    }
    return texts.map((text) => decodeVector(cache[textKey(text)]!));
  };
}
