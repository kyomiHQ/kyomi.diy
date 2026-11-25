import { embeddingModelInfo, type EmbeddingClassifierConfig } from "@kyomi/ingest";

/** Shared local encoder settings for refresh, extraction, training, and backfill. */
export function embeddingClassifierConfig(): EmbeddingClassifierConfig {
  return {};
}

/** Model, trained head, and selection rules used by every local classifier writer. */
export function activeEmbeddingModelId(): string {
  return embeddingModelInfo(embeddingClassifierConfig()).modelId;
}
