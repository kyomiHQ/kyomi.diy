import { describe, expect, test } from "bun:test";
import {
  classifyItemEmbeddings,
  MAX_CLASSIFIER_LABELS,
  scoreItemEmbeddings,
  type EmbeddingClassifierConfig,
} from "@kyomi/ingest";
import { cachedEmbeddings, embeddingsCacheFile } from "./embedding-cache";
import {
  accumulateConfusion,
  f1,
  precision,
  recall,
  renderScoreboard,
  round3,
  type Prediction,
} from "./classifier-eval-scoring";
import { CLASSIFIER_EVAL_FIXTURE, type ClassifierEvalCase } from "./classifier-eval-fixture";
import { CLASSIFIER_EVAL_STORED_CASES } from "./classifier-eval-stored-fixture";

/** Local production classifier evaluation, opt-in because it requires the compiled model. */
const enabled = process.env.CLASSIFIER_EVAL === "1" || process.env.CLASSIFIER_EVAL_OFFLINE === "1";
const config: EmbeddingClassifierConfig = { encode: cachedEmbeddings(embeddingsCacheFile("eval")) };

// The owner accepted the static model's measured stored-set regression on 2026-11-25.
// Freeze that exact 512-dimensional baseline: future changes must not lower it. BGE-M3's
// former gates (F1 .65, labeled top-1 .75, abstention <= .15) remain improvement targets,
// not claims that the static model matches transformer quality. See docs/architecture/embeddings.md.
const FLOORS = {
  stored: {
    f1: 0.6223404255319149,
    maxAbstention: 0.1246376811594203,
    labeledTop1: 0.717948717948718,
  },
  // Synthetic headlines; the head learned from real articles, so it is held to a lower floor.
  regression: { f1: 0.6 },
  field: { f1: 0.65 },
};

async function runEmbeddingClassifier(cases: readonly ClassifierEvalCase[]): Promise<Prediction[]> {
  const inputs = cases.map((case_) => ({ ...case_, maxLabels: MAX_CLASSIFIER_LABELS }));
  // In sequence, not in parallel: the cache doesn't coalesce concurrent misses, so the scoring
  // pass for the mismatch log reads what classification already embedded.
  const classifications = await classifyItemEmbeddings(inputs, config);
  const scores = await scoreItemEmbeddings(inputs, config);
  return cases.map((case_) => {
    const predicted = (classifications.get(case_.id)?.categories ?? []).map((c) => c.label);
    if ([...case_.expected].sort().join("|") !== [...predicted].sort().join("|")) {
      const top3 = (scores.get(case_.id) ?? [])
        .slice(0, 3)
        .map((entry) => `${entry.label}=${entry.score.toFixed(3)}`)
        .join(", ");
      console.log(
        `[mismatch] ${case_.id}: expected ${case_.expected.join(", ") || "none"}; predicted ${predicted.join(", ") || "none"}; top3 ${top3}`,
      );
    }
    return { case: case_, predicted };
  });
}

function report(name: string, predictions: readonly Prediction[]) {
  const { perCategory, overall } = accumulateConfusion(predictions);
  const abstention =
    predictions.filter((prediction) => prediction.predicted.length === 0).length /
    predictions.length;
  console.log(`\n${name}\n${renderScoreboard(perCategory, overall)}`);
  console.log(
    `${name}: F1=${round3(f1(overall))} P=${round3(precision(overall))} R=${round3(recall(overall))} abstain=${round3(abstention)}`,
  );
  return { f1: f1(overall), abstention };
}

describe.skipIf(!enabled)("embedding classifier eval (local static embeddings)", () => {
  test("preserves the accepted static stored-article baseline", async () => {
    const result = report(
      "Stored articles",
      await runEmbeddingClassifier(CLASSIFIER_EVAL_STORED_CASES),
    );

    // Equivalent F1 formulas differ by one floating-point ULP; no prediction-level slack.
    expect(result.f1 + Number.EPSILON).toBeGreaterThanOrEqual(FLOORS.stored.f1);
    expect(result.abstention).toBeLessThanOrEqual(FLOORS.stored.maxAbstention);
  }, 120_000);

  test("puts an expected category first for labeled stored articles", async () => {
    const labeled = CLASSIFIER_EVAL_STORED_CASES.filter((case_) => case_.expected.length > 0);
    const scores = await scoreItemEmbeddings(labeled, config);
    const top1 =
      labeled.filter((case_) => case_.expected.includes(scores.get(case_.id)?.[0]?.label ?? ""))
        .length / labeled.length;
    console.log(`Labeled stored articles (${labeled.length}): top-1 ${round3(top1)}`);

    expect(top1).toBeGreaterThanOrEqual(FLOORS.stored.labeledTop1);
  }, 120_000);

  test("keeps regression and coverage cases above their floor", async () => {
    const result = report(
      "Regression + coverage cases",
      await runEmbeddingClassifier(CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source !== "field")),
    );

    expect(result.f1).toBeGreaterThanOrEqual(FLOORS.regression.f1);
  }, 120_000);

  test("keeps held-out field cases above their floor", async () => {
    // Keep this small field set separate; candidate selection uses feed-grouped training CV.
    const result = report(
      "Held-out field cases",
      await runEmbeddingClassifier(CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source === "field")),
    );

    expect(result.f1).toBeGreaterThanOrEqual(FLOORS.field.f1);
  }, 120_000);
});
