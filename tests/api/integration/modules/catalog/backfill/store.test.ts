import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  recordFeedBackfillStatuses,
  syncInferredFeedBatch,
  type ProcessedFeedBatchEntry,
} from "@modules/catalog/backfill/store";
import type { BackfillClassifier } from "@modules/catalog/backfill/types";
import { fakeDb } from "@api-tests/support/layers";

const NOW = new Date("2026-11-25T00:00:00Z");
const CLASSIFIER: BackfillClassifier = {
  method: "embedding",
  embeddingConfig: {},
  model: { modelId: "local-test-model", taxonomyVersion: "v1", classifierMethod: "embedding" },
};
const STATS = {
  feedClassifierCategories: 1,
  feedClassifierFallbackSuppressed: false,
  itemsScanned: 0,
  itemsWithClassifierCategories: 0,
  itemClassifierAbstentions: 0,
};
const LABELS = [
  { label: "Software Engineering", confidence: 0.8 },
  { label: "Technology", confidence: 0.5 },
];
const entry = (id: string): ProcessedFeedBatchEntry => ({
  feed: {
    id,
    title: id,
    description: null,
    url: `https://example.com/${id}`,
    link: null,
    sourceKind: "rss",
  },
  feedCategories: [],
  items: [],
  stats: STATS,
});
type Statement = {
  table: string;
  operation: "insert" | "delete";
  sql: string;
  params: unknown[];
  values: Record<string, unknown>[];
};

/** Compile the actual Drizzle SQL, but intercept execution before any database connection. */
function boundedDatabase(beforeExecute?: (statement: Statement) => void) {
  const client = drizzle.mock();
  const statements: Statement[] = [];
  const start = (operation: "insert" | "delete", table: PgTable) => {
    const values: { rows: Record<string, unknown>[]; returning?: string[] } = { rows: [] };
    const wrap = (builder: object): object =>
      new Proxy(builder, {
        get(target, property) {
          if (property === "then") {
            return (resolve: (rows: unknown[]) => unknown, reject: (cause: unknown) => unknown) =>
              Promise.resolve()
                .then(() => {
                  const query = (target as { toSQL(): { sql: string; params: unknown[] } }).toSQL();
                  const statement = {
                    ...query,
                    operation,
                    table: getTableName(table),
                    values: values.rows,
                  };
                  // PostgreSQL's bind limit is the failure reproduced by this regression fixture.
                  if (query.params.length > 65_535)
                    throw new Error("PostgreSQL bind parameter limit exceeded");
                  statements.push(statement);
                  beforeExecute?.(statement);
                  return values.returning
                    ? values.rows.map((row) =>
                        Object.fromEntries(values.returning!.map((key) => [key, row[key]])),
                      )
                    : [];
                })
                .then(resolve, reject);
          }
          const method = Reflect.get(target, property);
          if (typeof method !== "function") return method;
          return (...args: unknown[]) => {
            if (property === "values") values.rows = args[0] as Record<string, unknown>[];
            if (property === "returning") values.returning = Object.keys(args[0] as object);
            return wrap(Reflect.apply(method, target, args) as object);
          };
        },
      });
    return wrap(operation === "insert" ? client.insert(table) : client.delete(table));
  };
  return {
    statements,
    layer: fakeDb({
      insert: (table: PgTable) => start("insert", table),
      delete: (table: PgTable) => start("delete", table),
    }),
  };
}
const inserted = (statements: Statement[], table: string) =>
  statements.filter((s) => s.operation === "insert" && s.table === table).flatMap((s) => s.values);
const deletedIds = (statements: Statement[], table: string) =>
  statements
    .filter((s) => s.operation === "delete" && s.table === table)
    .flatMap((s) => s.params.slice(0, -2));

describe("backfill store bounded statements", () => {
  test("handles one feed with more item IDs and assignments than fit in a statement", async () => {
    const feed = entry("large-feed");
    feed.items = Array.from({ length: 70_000 }, (_, i) => ({
      id: `item-${i}`,
      feedId: feed.feed.id,
      inferredCategoryLabels: i < 7_000 ? LABELS : [],
    }));
    const db = boundedDatabase();
    await Effect.runPromise(
      syncInferredFeedBatch([feed], CLASSIFIER, NOW).pipe(Effect.provide(db.layer)),
    );

    expect(new Set(deletedIds(db.statements, "feed_item_category_assignments")).size).toBe(70_000);
    const assignments = inserted(db.statements, "feed_item_category_assignments");
    expect(assignments).toHaveLength(14_000);
    expect(new Set(assignments.map((row) => row.feedItemId)).size).toBe(7_000);
    expect(assignments.every((row) => row.modelId === CLASSIFIER.model.modelId)).toBe(true);
    expect(
      db.statements
        .filter((s) => s.operation === "delete")
        .every((s) => s.params.slice(-2).join("|") === `classifier|${CLASSIFIER.model.modelId}`),
    ).toBe(true);
  }, 30_000);

  test("bounds feed deletes, category upserts, feed assignments and coverage statuses independently", async () => {
    const feeds = Array.from({ length: 70_000 }, (_, i) => ({
      ...entry(`feed-${i}`),
      feedCategories: i < 11_000 ? [{ label: `Topic ${i}`, confidence: 0.5 }] : [],
    }));
    const db = boundedDatabase();
    await Effect.runPromise(
      syncInferredFeedBatch(feeds, CLASSIFIER, NOW).pipe(Effect.provide(db.layer)),
    );
    await Effect.runPromise(
      recordFeedBackfillStatuses(
        feeds.slice(0, 5_000).map((feed) => ({
          feedId: feed.feed.id,
          status: "processed" as const,
          stats: STATS,
          errorMessage: null,
        })),
        CLASSIFIER,
        NOW,
      ).pipe(Effect.provide(db.layer)),
    );

    expect(new Set(deletedIds(db.statements, "feed_category_assignments")).size).toBe(70_000);
    expect(inserted(db.statements, "categories")).toHaveLength(11_000);
    expect(inserted(db.statements, "feed_category_assignments")).toHaveLength(11_000);
    expect(inserted(db.statements, "feed_category_backfill_status")).toHaveLength(5_000);
    expect(db.statements.every((s) => s.params.length <= 65_535)).toBe(true);
  }, 30_000);

  test("propagates a failed insert chunk and starts a retry by replacing the same model rows", async () => {
    let fail = true;
    let itemInserts = 0;
    const db = boundedDatabase((statement) => {
      if (
        statement.operation === "insert" &&
        statement.table === "feed_item_category_assignments" &&
        ++itemInserts === 2 &&
        fail
      )
        throw new Error("temporary write failure");
    });
    const feed = entry("retry-feed");
    feed.items = Array.from({ length: 2_000 }, (_, i) => ({
      id: `item-${i}`,
      feedId: feed.feed.id,
      inferredCategoryLabels: LABELS,
    }));
    const run = () => syncInferredFeedBatch([feed], CLASSIFIER, NOW).pipe(Effect.provide(db.layer));
    const error = await Effect.runPromise(Effect.flip(run()));
    expect(error._tag).toBe("DatabaseError");
    expect(error.operation).toBe("catalog.backfill.insertItemClassifierRows");
    fail = false;
    db.statements.length = 0;
    await Effect.runPromise(run());
    expect(db.statements[0]?.operation).toBe("delete");
    expect(inserted(db.statements, "feed_item_category_assignments")).toHaveLength(4_000);
    expect(
      db.statements
        .filter((s) => s.operation === "insert" && s.table === "feed_item_category_assignments")
        .every((s) => s.sql.includes("where model_id IS NOT NULL do update")),
    ).toBe(true);
  });
});
