import { CANONICAL_CATEGORY_LABELS, MISCELLANEOUS_CATEGORY_LABEL } from "@kyomi/db";
import { encodeTexts } from "../embeddings";
import { decodeCategoryModel, scoreWithCategoryModel, type CategoryModel } from "./category-model";
import { CATEGORY_MODEL_WEIGHTS } from "./category-model-weights";
import type { ClassifierModelInfo } from "./categories";
import {
  CLASSIFIER_TAXONOMY_VERSION,
  EMBEDDING_CLASSIFIER_METHOD,
  EMBEDDING_CLASSIFIER_MODEL_ID,
} from "./taxonomy";
import type {
  CategoryClassification,
  FeedCategoryClassificationInput,
  FeedItemCategoryClassificationInput,
} from "./classifier";
import { MAX_CLASSIFIER_LABELS } from "./classifier";

/** Local encoder and trained category-head configuration. No remote provider is required. */
export type EmbeddingClassifierConfig = {
  /** Explicit dependency seam for deterministic classifier tests. Production uses encoders. */
  encode?: (texts: readonly string[]) => Promise<number[][]>;
  /** Overrides the trained article head; for tests. */
  categoryModel?: CategoryModel;
  /** Overrides the article head's minimum probability; for evals and tests. */
  itemMinProbability?: number;
  /** Overrides the article head's secondary-label margin; for evals and tests. */
  itemSecondaryMargin?: number;
  /** Overrides the feed head's minimum probability; for evals and tests. */
  feedMinProbability?: number;
  /** Overrides the feed head's secondary-label margin; for evals and tests. */
  feedSecondaryMargin?: number;
};

/** A category's probability under the trained head for a text, best first. */
export type CategoryScore = { label: string; score: number };

export type CategorySelectionRule = {
  minSimilarity: number;
  secondaryMargin?: number;
};

// Articles: chosen by 5-fold cross-validation on the training articles behind the head (see
// apps/api/src/modules/catalog/category-model). An article takes its top category when the head
// gives it at least ITEM_MIN_PROBABILITY, and a second one only within ITEM_SECONDARY_MARGIN of it.
const ITEM_MIN_PROBABILITY = 0.18;
const ITEM_SECONDARY_MARGIN = 0.4;
// Feeds: the same head scores a feed's title and description. Calibrated against
// publisher-declared feed categories with
// tests/api/integration/modules/feeds/refresh/classifier-eval-sweep.test.ts: no higher floor
// keeps every label it gets right, and a second label within FEED_SECONDARY_MARGIN is nearly as
// often right as the first. A feed below the floor falls back to Miscellaneous.
const FEED_MIN_PROBABILITY = 0.1;
const FEED_SECONDARY_MARGIN = 0.05;
// Preserve bounded batches and partial-progress behavior for bulk ingestion.
const EMBEDDING_BATCH_MAX_INPUTS = 128;
// Cap total text per batch as well as the number of inputs.
const EMBEDDING_BATCH_MAX_CHARS = 200_000;
// Preserve the text preparation used by training, evaluation, and classification.
const MAX_CHARS_PER_INPUT = 6_000;
// Characters of title, summary, and body embedded per article. The opening carries the topic;
// later text is mostly related links, comments, and newsletter prompts that drag every
// category's similarity down, so feed text and extracted full text are cut to the same head.
const MAX_ITEM_TEXT_CHARS = 4_000;

function capText(text: string): string {
  if (text.length <= MAX_CHARS_PER_INPUT) {
    return text;
  }
  // Drop a surrogate half left at either cut so the text stays valid UTF-16.
  const head = text.slice(0, 4_500).replace(/[\uD800-\uDBFF]$/, "");
  const tail = text.slice(-1_500).replace(/^[\uDC00-\uDFFF]/, "");
  return `${head}\n\n[truncated]\n\n${tail}`;
}

/**
 * Caps each text and groups items into batches of at most EMBEDDING_BATCH_MAX_INPUTS texts and
 * EMBEDDING_BATCH_MAX_CHARS characters.
 */
function embeddingBatches<T>(
  items: readonly T[],
  textOf: (item: T) => string,
): Array<{ items: T[]; texts: string[] }> {
  const batches: Array<{ items: T[]; texts: string[] }> = [];
  let current: { items: T[]; texts: string[] } = { items: [], texts: [] };
  let chars = 0;
  for (const item of items) {
    const text = capText(textOf(item));
    const full =
      current.texts.length >= EMBEDDING_BATCH_MAX_INPUTS ||
      chars + text.length > EMBEDDING_BATCH_MAX_CHARS;
    if (current.texts.length > 0 && full) {
      batches.push(current);
      current = { items: [], texts: [] };
      chars = 0;
    }
    current.items.push(item);
    current.texts.push(text);
    chars += text.length;
  }
  if (current.texts.length > 0) {
    batches.push(current);
  }
  return batches;
}

async function encodeBatch(
  texts: readonly string[],
  config: EmbeddingClassifierConfig,
): Promise<number[][]> {
  const vectors = await (config.encode ?? encodeTexts)(texts);
  const dimensions = vectors[0]?.length;
  if (
    vectors.length !== texts.length ||
    !dimensions ||
    vectors.some(
      (vector) => vector.length !== dimensions || vector.some((value) => !Number.isFinite(value)),
    )
  ) {
    throw new Error(
      `Encoder returned invalid vectors: ${vectors.length} vectors for ${texts.length} inputs`,
    );
  }
  return vectors;
}

/**
 * Embeds input strings, returning one vector per input in the same order. Texts are capped and
 * encoded in bounded batches, yielding between batches to keep bulk work cooperative.
 */
export async function embedTexts(
  texts: readonly string[],
  config: EmbeddingClassifierConfig = {},
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const batch of embeddingBatches(texts, (text) => text)) {
    vectors.push(...(await encodeBatch(batch.texts, config)));
  }
  return vectors;
}

export type FeedItemEmbeddingBatchInput = FeedItemCategoryClassificationInput & {
  id: string;
  maxLabels?: number;
};

/** The production article and feed rules, for evals that replay them. */
export const DEFAULT_ITEM_SELECTION_RULE: CategorySelectionRule = {
  minSimilarity: ITEM_MIN_PROBABILITY,
  secondaryMargin: ITEM_SECONDARY_MARGIN,
};
export const DEFAULT_FEED_SELECTION_RULE: CategorySelectionRule = {
  minSimilarity: FEED_MIN_PROBABILITY,
  secondaryMargin: FEED_SECONDARY_MARGIN,
};

function itemSelectionRule(config: EmbeddingClassifierConfig): CategorySelectionRule {
  return {
    minSimilarity: config.itemMinProbability ?? ITEM_MIN_PROBABILITY,
    secondaryMargin: config.itemSecondaryMargin ?? ITEM_SECONDARY_MARGIN,
  };
}

function feedSelectionRule(config: EmbeddingClassifierConfig): CategorySelectionRule {
  return {
    minSimilarity: config.feedMinProbability ?? FEED_MIN_PROBABILITY,
    secondaryMargin: config.feedSecondaryMargin ?? FEED_SECONDARY_MARGIN,
  };
}

let defaultCategoryModel: CategoryModel | undefined;

function categoryModelFor(config: EmbeddingClassifierConfig): CategoryModel {
  if (config.categoryModel) {
    return config.categoryModel;
  }
  defaultCategoryModel ??= decodeCategoryModel(CATEGORY_MODEL_WEIGHTS);
  if (defaultCategoryModel.embeddingModelId !== EMBEDDING_CLASSIFIER_MODEL_ID) {
    throw new Error(
      "Category head was trained with a different encoder; retrain before starting Kyomi",
    );
  }
  return defaultCategoryModel;
}

/** The selection rule in effect, e.g. `item-0.2-0.3-feed-0.5-0.02`. */
function selectionRuleTag(config: EmbeddingClassifierConfig): string {
  const item = itemSelectionRule(config);
  const feed = feedSelectionRule(config);
  return `item-${item.minSimilarity}-${item.secondaryMargin}-feed-${feed.minSimilarity}-${feed.secondaryMargin}`;
}

export function embeddingModelInfo(config: EmbeddingClassifierConfig): ClassifierModelInfo {
  return {
    // Names the head and the selection rule as well as the model: any of them can yield different
    // labels for identical inputs, and rows written under another one must not read as current or
    // count as backfilled.
    modelId: `${EMBEDDING_CLASSIFIER_MODEL_ID}/${categoryModelFor(config).version}/${selectionRuleTag(config)}`,
    taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
    classifierMethod: EMBEDDING_CLASSIFIER_METHOD,
  };
}

function toConfidence(similarity: number): number {
  return Math.max(0.1, Math.min(0.95, Number(similarity.toFixed(2))));
}

function buildFeedText(input: FeedCategoryClassificationInput): string {
  return [input.feedTitle, input.feedDescription].filter(Boolean).join(". ");
}

function buildItemText(input: FeedItemCategoryClassificationInput): string {
  const text = [input.itemTitle, input.itemSummary, input.itemContentText]
    .filter(Boolean)
    .join(". ");
  if (text.length <= MAX_ITEM_TEXT_CHARS) {
    return text;
  }
  // Drop a high surrogate left at the cut so the text stays valid UTF-16.
  return text.slice(0, MAX_ITEM_TEXT_CHARS).replace(/[\uD800-\uDBFF]$/, "");
}

function toCategoryClassification(scores: readonly CategoryScore[]): CategoryClassification {
  return {
    categories: scores.map((entry) => ({
      label: entry.label,
      confidence: toConfidence(entry.score),
    })),
  };
}

/**
 * Picks labels from category scores sorted high to low. The top category is kept when it
 * clears `minSimilarity`. Each further category must also clear it and sit within
 * `secondaryMargin` of the top score, so a semantically adjacent runner-up doesn't ride along
 * on a single-topic text. Without a margin every category over the floor qualifies.
 */
export function selectCategories(
  scores: readonly CategoryScore[],
  rule: CategorySelectionRule,
  maxLabels: number,
): CategoryScore[] {
  const [top] = scores;
  if (!top || top.score < rule.minSimilarity) {
    return [];
  }
  const margin = rule.secondaryMargin ?? Number.POSITIVE_INFINITY;
  return scores
    .filter(
      (entry, index) =>
        index === 0 || (entry.score >= rule.minSimilarity && top.score - entry.score <= margin),
    )
    .slice(0, maxLabels);
}

/** Scores a feed's title and description with the trained head, best first. */
export async function scoreFeedEmbedding(
  input: FeedCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
): Promise<CategoryScore[]> {
  const model = categoryModelFor(config);
  const [textEmbedding] = await embedTexts([buildFeedText(input)], config);
  return textEmbedding ? scoreWithCategoryModel(model, textEmbedding) : [];
}

/**
 * Embeds items' title, summary, and opening text in bounded batches, returning each item's vector
 * by id. Items in a failed batch are left out; the error is rethrown only when every batch
 * failed.
 */
export async function embedItemVectors(
  inputs: ReadonlyArray<FeedItemCategoryClassificationInput & { id: string }>,
  config: EmbeddingClassifierConfig,
): Promise<Map<string, number[]>> {
  const vectors = new Map<string, number[]>();
  let failure: unknown;
  for (const batch of embeddingBatches(inputs, buildItemText)) {
    let textEmbeddings: number[][];
    try {
      textEmbeddings = await encodeBatch(batch.texts, config);
    } catch (error) {
      failure = error;
      continue;
    }
    batch.items.forEach((input, index) => {
      const vector = textEmbeddings[index];
      if (vector) {
        vectors.set(input.id, vector);
      }
    });
  }
  if (vectors.size === 0 && failure !== undefined) {
    throw failure;
  }
  return vectors;
}

/**
 * Scores items with the trained article head, best first, in bounded embedding batches. Items
 * in a failed batch are left out of the result; the error is rethrown only when every batch
 * failed.
 */
export async function scoreItemEmbeddings(
  inputs: ReadonlyArray<FeedItemCategoryClassificationInput & { id: string }>,
  config: EmbeddingClassifierConfig,
): Promise<Map<string, CategoryScore[]>> {
  if (inputs.length === 0) {
    return new Map();
  }
  const model = categoryModelFor(config);
  const vectors = await embedItemVectors(inputs, config);
  return new Map([...vectors].map(([id, vector]) => [id, scoreWithCategoryModel(model, vector)]));
}

export async function classifyFeedEmbedding(
  input: FeedCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
): Promise<CategoryClassification> {
  const selected = selectCategories(
    await scoreFeedEmbedding(input, config),
    feedSelectionRule(config),
    MAX_CLASSIFIER_LABELS,
  );
  if (selected.length === 0) {
    // A feed always needs some label, mirroring the keyword classifier's feed-level
    // `allowGeneralFallback: true` — unlike an individual article, a feed cannot simply
    // abstain, or it would show no categorization at all in the UI indefinitely.
    return { categories: [{ label: MISCELLANEOUS_CATEGORY_LABEL, confidence: 0.1 }] };
  }
  return toCategoryClassification(selected);
}

export async function classifyItemEmbedding(
  input: FeedItemCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
  // Unlike the keyword classifier, similarity scoring has no natural label count to default
  // to: MAX_CLASSIFIER_LABELS is a UI chip-slot budget, not evidence about how many topics an
  // article legitimately spans. Callers with a real slot budget (e.g. refresh.ts) pass their
  // own maxLabels; this default only governs raw classification (e.g. eval harnesses), so it
  // should let every category that clears the threshold through rather than truncate early.
  maxLabels: number = CANONICAL_CATEGORY_LABELS.length,
): Promise<CategoryClassification> {
  const scores = await scoreItemEmbeddings([{ ...input, id: "item" }], config);
  return toCategoryClassification(
    selectCategories(scores.get("item") ?? [], itemSelectionRule(config), maxLabels),
  );
}

/**
 * Classifies items in bounded embedding batches. Items in a failed batch are left out of the
 * result so callers keep those items' existing labels; the error is rethrown only when every
 * batch failed.
 */
export async function classifyItemEmbeddings(
  inputs: readonly FeedItemEmbeddingBatchInput[],
  config: EmbeddingClassifierConfig,
): Promise<Map<string, CategoryClassification>> {
  const scores = await scoreItemEmbeddings(inputs, config);
  const rule = itemSelectionRule(config);
  const results = new Map<string, CategoryClassification>();
  for (const input of inputs) {
    const itemScores = scores.get(input.id);
    if (itemScores) {
      results.set(
        input.id,
        toCategoryClassification(
          selectCategories(itemScores, rule, input.maxLabels ?? CANONICAL_CATEGORY_LABELS.length),
        ),
      );
    }
  }
  return results;
}
