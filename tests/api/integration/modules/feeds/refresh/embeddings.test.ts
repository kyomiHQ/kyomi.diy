import { describe, expect, test } from "bun:test";
import {
  classifyFeedEmbedding,
  classifyItemEmbedding,
  classifyItemEmbeddings,
  embedTexts,
  type EmbeddingClassifierConfig,
} from "@kyomi/ingest";
import { FAKE_CATEGORY_MODEL } from "./fake-category-model";

const FAKE_CONFIG: EmbeddingClassifierConfig = {
  categoryModel: FAKE_CATEGORY_MODEL,
};

/**
 * Deterministic 3-dimensional "embeddings" — real model vectors are much higher-dimensional, but
 * a small hand-computable space, with FAKE_CATEGORY_MODEL as the category head, is enough to verify
 * the scoring, threshold, and fallback logic without needing real semantics.
 */
const UNIT_X = [1, 0, 0];
const UNIT_Y = [0, 1, 0];
const ORTHOGONAL_Z = [0, 0, 1];

describe("embedTexts", () => {
  test("preserves input order", async () => {
    const result = await embedTexts(["a", "b"], {
      encode: async (texts) => {
        expect(texts).toEqual(["a", "b"]);
        return [UNIT_X, UNIT_Y];
      },
    });
    expect(result).toEqual([UNIT_X, UNIT_Y]);
  });

  test("does not initialize the encoder for empty input", async () => {
    expect(
      await embedTexts([], {
        encode: async () => {
          throw new Error("unexpected");
        },
      }),
    ).toEqual([]);
  });

  test("propagates encoder failures", async () => {
    await expect(
      embedTexts(["a"], {
        encode: async () => {
          throw new Error("unavailable");
        },
      }),
    ).rejects.toThrow("unavailable");
  });

  test("rejects missing, inconsistent, and nonfinite vectors", async () => {
    for (const vectors of [
      [UNIT_X],
      [UNIT_X, []],
      [UNIT_X, [NaN, 0, 0]],
      [UNIT_X, [Infinity, 0, 0]],
    ]) {
      await expect(embedTexts(["a", "b"], { encode: async () => vectors })).rejects.toThrow(
        "invalid vectors",
      );
    }
  });
});

/** Inject the encoder at the existing classification seam. */
function fakeWorker(vectorFor: (text: string, index: number, inputs: string[]) => number[]) {
  const requests: string[][] = [];
  FAKE_CONFIG.encode = async (texts) => {
    const inputs = [...texts];
    requests.push(inputs);
    return inputs.map((text, index) => vectorFor(text, index, inputs));
  };
  return requests;
}

const ARTICLE = {
  feedTitle: "Hacker News",
  feedDescription: null,
  feedUrl: "https://news.ycombinator.com/rss",
  feedSiteUrl: "https://news.ycombinator.com",
  sourceKind: "rss",
  itemTitle: "Some article",
  itemSummary: null,
  itemUrl: null,
};

describe("classifyItemEmbedding", () => {
  test("embeds a batch of articles in one request", async () => {
    const requests = fakeWorker((text) => (text.startsWith("First") ? UNIT_X : ORTHOGONAL_Z));

    const result = await classifyItemEmbeddings(
      [
        {
          ...ARTICLE,
          id: "item-1",
          itemTitle: "First item",
          itemContentText: "Detailed body",
          maxLabels: 1,
        },
        {
          ...ARTICLE,
          id: "item-2",
          itemTitle: "Second item",
          itemContentText: "Other body",
          maxLabels: 1,
        },
      ],
      FAKE_CONFIG,
    );

    expect(requests).toEqual([["First item. Detailed body", "Second item. Other body"]]);
    expect(result.get("item-1")?.categories[0]?.label).toBe("Software Engineering");
    expect(result.get("item-2")?.categories).toEqual([]);
  });

  test("returns the head's top category with its probability as confidence", async () => {
    fakeWorker(() => UNIT_X);

    const result = await classifyItemEmbedding(ARTICLE, FAKE_CONFIG);

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
    expect(result.categories[0]?.confidence).toBeGreaterThan(0.9);
  });

  test("abstains when the head puts its weight on no category", async () => {
    fakeWorker(() => ORTHOGONAL_Z);

    const result = await classifyItemEmbedding(ARTICLE, FAKE_CONFIG);

    // Item-level classification must be able to abstain entirely — the same discipline the
    // keyword classifier's `allowGeneralFallback: false` enforces at item level.
    expect(result.categories).toEqual([]);
  });

  test("admits a second category only within the secondary margin of the first", async () => {
    // Close to both the Software Engineering and Technology axes: about 0.57 and 0.42.
    fakeWorker(() => [1, 0.95, 0]);

    const wide = await classifyItemEmbedding(ARTICLE, {
      ...FAKE_CONFIG,
      itemMinProbability: 0.1,
      itemSecondaryMargin: 0.3,
    });
    const narrow = await classifyItemEmbedding(ARTICLE, {
      ...FAKE_CONFIG,
      itemMinProbability: 0.1,
      itemSecondaryMargin: 0.05,
    });

    expect(wide.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
      "Technology",
    ]);
    expect(narrow.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });
});

describe("classifyFeedEmbedding", () => {
  const FEED = {
    feedTitle: "Some feed",
    feedDescription: "Notes on building software",
    feedUrl: "https://example.com/rss",
    feedSiteUrl: "https://example.com",
    sourceKind: "rss",
  };

  test("scores the feed's title and description with the head in one request", async () => {
    const requests = fakeWorker(() => UNIT_X);

    const result = await classifyFeedEmbedding(FEED, FAKE_CONFIG);

    expect(requests).toEqual([["Some feed. Notes on building software"]]);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
    expect(result.categories[0]?.confidence).toBeGreaterThan(0.9);
  });

  test("falls back to Miscellaneous at low confidence when nothing clears the floor", async () => {
    fakeWorker(() => ORTHOGONAL_Z);

    const result = await classifyFeedEmbedding(FEED, FAKE_CONFIG);

    // Unlike item-level classification, a feed must always resolve to some label — this is
    // the same discipline as the keyword classifier's feed-level `allowGeneralFallback: true`.
    expect(result.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
  });

  test("admits a second category only within the feed secondary margin", async () => {
    // About 0.57 Software Engineering and 0.42 Technology.
    fakeWorker(() => [1, 0.95, 0]);

    const narrow = await classifyFeedEmbedding(FEED, FAKE_CONFIG);
    const wide = await classifyFeedEmbedding(FEED, { ...FAKE_CONFIG, feedSecondaryMargin: 0.2 });

    expect(narrow.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
    expect(wide.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
      "Technology",
    ]);
  });
});
