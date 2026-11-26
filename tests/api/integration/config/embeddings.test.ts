import { describe, expect, test } from "bun:test";
import { EMBEDDING_CLASSIFIER_MODEL_ID, embeddingModelInfo } from "@kyomi/ingest";
import { activeEmbeddingModelId, embeddingClassifierConfig } from "@config/embeddings";

describe("local embedding configuration", () => {
  test("needs no provider credentials and identifies the active model and trained head", () => {
    const config = embeddingClassifierConfig();
    expect(config).toEqual({});
    expect(activeEmbeddingModelId()).toBe(embeddingModelInfo(config).modelId);
    expect(activeEmbeddingModelId().startsWith(`${EMBEDDING_CLASSIFIER_MODEL_ID}/`)).toBe(true);
  });

  test("gives rows written under another selection rule a different model id", () => {
    const config = embeddingClassifierConfig();
    expect(embeddingModelInfo({ ...config, itemMinProbability: 0.99 }).modelId).not.toBe(
      embeddingModelInfo(config).modelId,
    );
  });
});
