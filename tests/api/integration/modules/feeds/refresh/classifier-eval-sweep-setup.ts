import { readFileSync } from "node:fs";
import {
  embedTexts,
  type CategorySelectionRule,
  type EmbeddingClassifierConfig,
} from "@kyomi/ingest";
import { cachedEmbeddings, embeddingsCacheFile } from "./embedding-cache";

/** Shared setup for the opt-in (`CLASSIFIER_SWEEP=1`) article and feed rule sweeps. */

export const SWEEP_ENABLED = process.env.CLASSIFIER_SWEEP === "1";
export const sweepConfig: EmbeddingClassifierConfig = {
  encode: cachedEmbeddings(embeddingsCacheFile("sweep")),
};

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function describeRule(rule: CategorySelectionRule): string {
  return `floor ${rule.minSimilarity.toFixed(2)} margin ${rule.secondaryMargin?.toFixed(2) ?? "none"}`;
}

/**
 * Embeds feed texts in one batched call first, so scoring feeds one at a time reads the cache
 * instead of sending one request per feed. Mirrors the classifier's title-and-description text.
 */
export async function prewarmFeedTexts(
  feeds: ReadonlyArray<{ feedTitle: string; feedDescription: string | null }>,
): Promise<void> {
  const texts = feeds.map((feed) =>
    [feed.feedTitle, feed.feedDescription].filter(Boolean).join(". "),
  );
  await embedTexts(texts.filter(Boolean), sweepConfig);
}
