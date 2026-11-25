import { Effect } from "effect";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedCategoryBackfillStatus,
  feedItemCategoryAssignments,
  toCategorySlug,
} from "@kyomi/db";
import {
  canonicalWinsOnConflictSql,
  CATEGORY_CLASSIFIER_PROVENANCE,
  type InferredCategoryLabel,
} from "@kyomi/ingest";
import { Db } from "@adapters/db/service";
import {
  BACKFILL_STATUS_FAILED,
  BACKFILL_STATUS_PROCESSED,
  type BackfillClassifier,
  type BackfillFeedRecord,
  type ProcessedFeedStats,
} from "./types";

// The widest row below has 15 bound columns. Keep every statement well below PostgreSQL's
// 65,535-parameter limit, independently of the number of items in a feed/page.
const WRITE_BATCH_SIZE = 1_000;

type CategoryRecord = {
  slug: string;
  label: string;
  confidence?: number;
};

export type InferredBackfillItem = {
  id: string;
  feedId: string;
  inferredCategoryLabels: InferredCategoryLabel[];
};

export type ProcessedFeedBatchEntry = {
  feed: BackfillFeedRecord;
  feedCategories: InferredCategoryLabel[];
  items: InferredBackfillItem[];
  stats: ProcessedFeedStats;
};

export type BackfillStatusRecord = {
  feedId: string;
  status: typeof BACKFILL_STATUS_PROCESSED | typeof BACKFILL_STATUS_FAILED;
  stats: ProcessedFeedStats;
  errorMessage: string | null;
};

function normalizeInferredRecords(labels: InferredCategoryLabel[]): CategoryRecord[] {
  const bySlug = new Map<string, CategoryRecord>();
  for (const label of labels) {
    const trimmed = label.label.trim();
    const slug = toCategorySlug(trimmed);
    if (!slug || bySlug.has(slug)) {
      continue;
    }
    bySlug.set(slug, {
      slug,
      label: trimmed,
      confidence: Math.max(0, Math.min(1, label.confidence)),
    });
  }
  return [...bySlug.values()];
}

const upsertClassifierCategories = Effect.fn("catalog.backfill.upsertCategories")(function* (
  records: CategoryRecord[],
  now: Date,
) {
  const uniqueRecords = new Map<string, CategoryRecord>();
  for (const record of records) {
    if (!uniqueRecords.has(record.slug)) {
      uniqueRecords.set(record.slug, record);
    }
  }
  if (uniqueRecords.size === 0) {
    return new Map<string, string>();
  }
  const db = yield* Db;
  const recordsToUpsert = [...uniqueRecords.values()];
  const idsBySlug = new Map<string, string>();
  for (let start = 0; start < recordsToUpsert.length; start += WRITE_BATCH_SIZE) {
    const batch = recordsToUpsert.slice(start, start + WRITE_BATCH_SIZE);
    const rows = yield* db.use("catalog.backfill.upsertCategories", async (client) =>
      client
        .insert(categories)
        .values(
          batch.map((record) => ({
            id: crypto.randomUUID(),
            slug: record.slug,
            label: record.label,
            provenance: CATEGORY_CLASSIFIER_PROVENANCE,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
            provenance: canonicalWinsOnConflictSql(categories.provenance, sql`excluded.provenance`),
            updatedAt: now,
          },
        })
        .returning({ id: categories.id, slug: categories.slug }),
    );
    for (const row of rows) {
      idsBySlug.set(row.slug, row.id);
    }
  }
  return idsBySlug;
});

/** The columns a classifier assignment row carries, whichever table it goes to. */
function classifierRow(
  record: CategoryRecord,
  categoryId: string,
  classifier: BackfillClassifier,
  now: Date,
) {
  return {
    id: crypto.randomUUID(),
    categoryId,
    provenance: CATEGORY_CLASSIFIER_PROVENANCE,
    confidence: record.confidence,
    modelId: classifier.model.modelId,
    taxonomyVersion: classifier.model.taxonomyVersion,
    classifierMethod: classifier.model.classifierMethod,
    createdAt: now,
    updatedAt: now,
  };
}

const classifierConflictSet = (now: Date) => ({
  confidence: sql`excluded.confidence`,
  taxonomyVersion: sql`excluded.taxonomy_version`,
  classifierMethod: sql`excluded.classifier_method`,
  updatedAt: now,
});

/**
 * Replaces the classifier rows of a batch of feeds and their items: deletes this model's rows,
 * upserts the categories once, then inserts the new feed and item assignments.
 */
export const syncInferredFeedBatch = Effect.fn("catalog.backfill.syncBatch")(function* (
  entries: ProcessedFeedBatchEntry[],
  classifier: BackfillClassifier,
  now: Date,
) {
  if (entries.length === 0) {
    return;
  }
  const db = yield* Db;
  const feedIds = entries.map((entry) => entry.feed.id);
  const itemIds = entries.flatMap((entry) => entry.items.map((item) => item.id));

  for (let start = 0; start < feedIds.length; start += WRITE_BATCH_SIZE) {
    const batch = feedIds.slice(start, start + WRITE_BATCH_SIZE);
    yield* db.use("catalog.backfill.deleteFeedClassifierRows", async (client) => {
      await client
        .delete(feedCategoryAssignments)
        .where(
          and(
            inArray(feedCategoryAssignments.feedId, batch),
            eq(feedCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
            eq(feedCategoryAssignments.modelId, classifier.model.modelId),
          ),
        );
    });
  }
  for (let start = 0; start < itemIds.length; start += WRITE_BATCH_SIZE) {
    const batch = itemIds.slice(start, start + WRITE_BATCH_SIZE);
    yield* db.use("catalog.backfill.deleteItemClassifierRows", async (client) => {
      await client
        .delete(feedItemCategoryAssignments)
        .where(
          and(
            inArray(feedItemCategoryAssignments.feedItemId, batch),
            eq(feedItemCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
            eq(feedItemCategoryAssignments.modelId, classifier.model.modelId),
          ),
        );
    });
  }

  const planned = entries.map((entry) => ({
    entry,
    feedRecords: normalizeInferredRecords(entry.feedCategories),
    items: entry.items.map((item) => ({
      item,
      records: normalizeInferredRecords(item.inferredCategoryLabels),
    })),
  }));
  const categoryIdsBySlug = yield* upsertClassifierCategories(
    planned.flatMap(({ feedRecords, items }) => [
      ...feedRecords,
      ...items.flatMap(({ records }) => records),
    ]),
    now,
  );

  const feedAssignments = planned.flatMap(({ entry, feedRecords }) =>
    feedRecords.flatMap((record) => {
      const categoryId = categoryIdsBySlug.get(record.slug);
      return categoryId
        ? [{ ...classifierRow(record, categoryId, classifier, now), feedId: entry.feed.id }]
        : [];
    }),
  );
  for (let start = 0; start < feedAssignments.length; start += WRITE_BATCH_SIZE) {
    const batch = feedAssignments.slice(start, start + WRITE_BATCH_SIZE);
    yield* db.use("catalog.backfill.insertFeedClassifierRows", async (client) => {
      await client
        .insert(feedCategoryAssignments)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            feedCategoryAssignments.feedId,
            feedCategoryAssignments.categoryId,
            feedCategoryAssignments.provenance,
            feedCategoryAssignments.modelId,
          ],
          targetWhere: sql`model_id IS NOT NULL`,
          set: classifierConflictSet(now),
        });
    });
  }

  const itemAssignments = planned.flatMap(({ items }) =>
    items.flatMap(({ item, records }) =>
      records.flatMap((record) => {
        const categoryId = categoryIdsBySlug.get(record.slug);
        return categoryId
          ? [{ ...classifierRow(record, categoryId, classifier, now), feedItemId: item.id }]
          : [];
      }),
    ),
  );
  for (let start = 0; start < itemAssignments.length; start += WRITE_BATCH_SIZE) {
    const batch = itemAssignments.slice(start, start + WRITE_BATCH_SIZE);
    yield* db.use("catalog.backfill.insertItemClassifierRows", async (client) => {
      await client
        .insert(feedItemCategoryAssignments)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            feedItemCategoryAssignments.feedItemId,
            feedItemCategoryAssignments.categoryId,
            feedItemCategoryAssignments.provenance,
            feedItemCategoryAssignments.modelId,
          ],
          targetWhere: sql`model_id IS NOT NULL`,
          set: classifierConflictSet(now),
        });
    });
  }
});

/** Upserts one coverage row per feed for this classifier model. */
export const recordFeedBackfillStatuses = Effect.fn("catalog.backfill.recordStatuses")(function* (
  records: BackfillStatusRecord[],
  classifier: BackfillClassifier,
  now: Date,
) {
  if (records.length === 0) {
    return;
  }
  const db = yield* Db;
  for (let start = 0; start < records.length; start += WRITE_BATCH_SIZE) {
    const batch = records.slice(start, start + WRITE_BATCH_SIZE);
    yield* db.use("catalog.backfill.recordStatuses", async (client) => {
      await client
        .insert(feedCategoryBackfillStatus)
        .values(
          batch.map((record) => ({
            feedId: record.feedId,
            classifierMethod: classifier.model.classifierMethod,
            modelId: classifier.model.modelId,
            taxonomyVersion: classifier.model.taxonomyVersion,
            status: record.status,
            feedClassifierCategories: record.stats.feedClassifierCategories,
            feedClassifierFallbackSuppressed: record.stats.feedClassifierFallbackSuppressed,
            itemsScanned: record.stats.itemsScanned,
            itemsWithClassifierCategories: record.stats.itemsWithClassifierCategories,
            itemClassifierAbstentions: record.stats.itemClassifierAbstentions,
            lastError: record.errorMessage,
            processedAt: record.status === BACKFILL_STATUS_PROCESSED ? now : null,
            failedAt: record.status === BACKFILL_STATUS_FAILED ? now : null,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [
            feedCategoryBackfillStatus.feedId,
            feedCategoryBackfillStatus.classifierMethod,
            feedCategoryBackfillStatus.modelId,
            feedCategoryBackfillStatus.taxonomyVersion,
          ],
          set: {
            status: sql`excluded.status`,
            feedClassifierCategories: sql`excluded.feed_classifier_categories`,
            feedClassifierFallbackSuppressed: sql`excluded.feed_classifier_fallback_suppressed`,
            itemsScanned: sql`excluded.items_scanned`,
            itemsWithClassifierCategories: sql`excluded.items_with_classifier_categories`,
            itemClassifierAbstentions: sql`excluded.item_classifier_abstentions`,
            lastError: sql`excluded.last_error`,
            processedAt: sql`excluded.processed_at`,
            failedAt: sql`excluded.failed_at`,
            updatedAt: now,
          },
        });
    });
  }
});
