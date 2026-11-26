import { describe, expect, test } from "bun:test";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID, encodeTexts } from "@kyomi/ingest";

const norm = (vector: readonly number[]) =>
  Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
const cosine = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, value, index) => sum + value * b[index]!, 0) / (norm(a) * norm(b));

describe("compiled local embeddings", () => {
  test("empty batches return no vectors", async () => {
    expect(await encodeTexts([])).toEqual([]);
  });

  test("produces finite nonzero vectors across supported languages", async () => {
    const texts = [
      "Artificial intelligence and machine learning research",
      "人工智能与机器学习研究",
      "новости науки и технологий",
      "日本の科学技術ニュース",
    ];
    const vectors = await encodeTexts(texts);
    expect(vectors).toHaveLength(texts.length);
    for (const vector of vectors) {
      expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(vector.every(Number.isFinite)).toBe(true);
      expect(norm(vector)).toBeGreaterThan(0);
    }
    expect(EMBEDDING_MODEL_ID).toContain("635eb094a82ce43f0eb882c12b31406b3d93ec26");
  });

  test("returns stable vectors in input order across repeated and concurrent calls", async () => {
    const texts = ["Software engineering and Rust compilers", "Cooking recipes and baking bread"];
    const combined = await encodeTexts(texts);
    const separate = await Promise.all(texts.map((text) => encodeTexts([text])));
    expect(combined).toEqual(separate.map(([vector]) => vector!));
    expect(combined[0]).not.toEqual(combined[1]);
  });

  test("ranks the matching topic above an unrelated one", async () => {
    const [query, relevant, unrelated] = await encodeTexts([
      "What is the capital of France?",
      "Paris is the capital of France.",
      "Tokyo is the capital of Japan.",
    ]);
    expect(cosine(query!, relevant!)).toBeGreaterThan(cosine(query!, unrelated!));
  });

  test("empty text is finite and oversized UTF-8 input is rejected", async () => {
    const [empty] = await encodeTexts([""]);
    expect(empty).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(empty!.every(Number.isFinite)).toBe(true);
    await expect(encodeTexts(["文".repeat(100_000)])).rejects.toThrow("UTF-8 bytes");
    // A failed request must not poison the shared instance or leak a partial batch.
    expect((await encodeTexts(["healthy input"])).length).toBe(1);
  });
});
