# Local embeddings

`packages/ingest/src/services/embeddings.ts` owns the server-only encoder. Existing feed
classification in `services/feed/embeddings.ts` continues to own text preparation, batch limits,
partial failures, category-head scoring, and article/feed selection rules. The API wraps these
Promise operations through its existing Effect services. No new service process or workspace is
required.

The implementation uses `encoders =3.1.0`, Bekko slim-100k revision
`635eb094a82ce43f0eb882c12b31406b3d93ec26`, 512 dimensions, and int8 table storage. Rust compiles the
model into a WASM artifact at build time. The application lazily instantiates it once per process;
`AppLive` initializes it during boot so a missing artifact fails startup. Each input is bounded and
bulk encoding yields between texts. Application requests never download weights or spawn Cargo.

The upstream model returns unnormalized pooled vectors. The existing classifier normalizes them;
other consumers must use cosine similarity or explicitly normalize before a dot product. Empty
text produces a finite zero vector and supplies no semantic evidence.

## Build and deployment

Install Rust 1.99.1 and `rustup target add wasm32-unknown-unknown`, then run:

```sh
bun run --cwd packages/ingest embeddings:build
```

Cargo.lock and the explicit model feature pin the source model revision and dependencies. The
first build downloads source weights; subsequent builds use `encoders/target/ese-cache`.
`encoders/dist/kyomi_encoders.wasm` is generated, ignored, included in the ingest Turbo build
outputs, and copied from a dedicated Rust stage into the API image. Rust is absent from runtime
images. `docker:up` builds the host artifact before starting the bind-mounted development stack.
Direct host commands need the same build first. CI builds the artifact before API tests and builds.

## Model migration

The encoder identity includes model revision, dimensions, quantization, and pooling implementation.
Generated category weights carry that identity; production classification rejects a head trained
with another encoder even if dimensions match. Evaluation caches use model-specific directories.

Use the existing `category:train` command to retrain from the labeled articles and recalibrate
selection rules using feed-grouped cross-validation. Keep held-out evaluation floors unchanged.
Only after accepting quality, run:

```sh
bun run categories:backfill -- --classifier embedding --all --apply
bun run categories:report
```

Backfill retains prior-model rows; reads and coverage reports select the active model. Backfill
status is also model-specific, so old completion records do not skip new-model work. Rollback
requires restoring the old encoder, matching head, and read identity together.

Cloudflare `/embed` and its application configuration are removed. The separate gateway still
serves `/translate` and `/chat`. Chat now requires Worker secret `CHAT_TOKEN`; evaluation clients
use `CLOUDFLARE_CHAT_URL` and `CLOUDFLARE_CHAT_TOKEN`. Provision that secret when deploying the gateway.
Local environment migration does not provision a remote Worker secret or deploy the gateway.

## Evaluation on 2026-11-25

Training has 1,854 labeled articles. Exactly 1,844 current article texts match archived BGE-M3
vectors, allowing a paid-free matched comparison. The 345 stored evaluation articles are disjoint
from training. Training options and text preparation are held constant unless explicitly stated.

| Model                      | Matched CV top1 | Matched CV best micro F1 | Stored top1 | Stored F1 |
| -------------------------- | --------------: | -----------------------: | ----------: | --------: |
| BGE-M3 baseline            |          77.47% |                   70.03% |      75.32% |    68.70% |
| Bekko slim100k, 512, int8  |          74.81% |                   67.35% |      71.79% |    62.23% |
| Bekko slim100k, 1024, int8 |          75.12% |                   67.29% |      68.91% |    62.30% |

All three static candidates fail existing stored-data gates (75% top1, 65% F1). The 512,
slim1024, and full1024 stored abstention rates are 12.46%, 15.65%, and 20.29% respectively;
the latter two also fail the 15% abstention ceiling. Full200k uses its cross-validation-selected
article rule (floor .20, secondary margin .30); the slim candidates retain .18/.40. Full200k is
pinned to revision `c18167b8f244c1bc6de21ce9b710bac8a29c4615`. No evaluation floors were lowered.

The smaller regression and field samples pass, illustrating why those samples alone are
insufficient. Changing L2 to 1e-4 or 1e-3 did not improve matched CV F1 for the 512 candidate;
existing 3e-4 regularization remains selected. The committed implementation retains the 512
candidate: doubling its width or using the full vocabulary did not restore held-out quality.
The full model's 209,005,448-byte artifact and measured approximately 1 GB load-time RSS peak
add cost without resolving that regression. The existing article and feed selection rules remain.

No database backfill or deployment has been applied. This implementation is reviewable, but
acceptance of the measured categorization tradeoff is still pending; it is not quality parity.
The full swap must not be reported as production-ready while these quality gates fail.

Two small interest-ranking smoke checks use explicit cosine similarity, including Chinese and
French queries. They show basic feasibility, not independently judged recommendation quality.
Onboarding bundle generation and feed profiles remain separate product work.

## Decision and regret analysis

The severe risks are mixing incompatible model artifacts and accepting semantic regression based
on speed alone. Identity checks, retraining, model-scoped caches, and held-out evaluations address
those risks. Static pooling is order-blind: the measured vectors for “dog bites man” and “man bites
dog” are identical. This limitation cannot be fixed by changing the runtime bridge.

WASM keeps one portable artifact and avoids native binding distribution or subprocess lifecycle
code. Its bridge can be replaced later through `encodeTexts` if measurements justify that work.
The 512 artifact is 52,840,828 bytes. A local sample measured approximately 156 microseconds per
4,000-character input including scheduling, under concurrent work; it is not a production capacity
measurement. Deterministic 3/12-month growth and transport-overhead sensitivity scripts were run
in scratch, with assumptions distinguished from measurements. They did not justify introducing a
separate process before task quality is established.

## Documentation evidence

- Owner/context: project architecture, packages/ingest, API, testing, environment, security and QA
  skills; existing category training, refresh, extraction, and backfill paths.
- Runtime proof: encoders 3.1.0 source and pinned model catalog, generated model constants,
  Effect 4.1.4 `Layer.effectDiscard` declarations; actual Bun 1.3.14 Linux encoding with networking
  disabled, plus successful `AppLive` initialization and disposal.
- Official references, accessed 2026-11-25:
  [encoders](https://docs.rs/encoders/3.1.0/encoders/),
  [model catalog](https://github.com/flowercomputers/encoders),
  [Rust WASM target](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html).
- Applied contract: fixed static model, build-time downloads only, explicit identity, WASM target
  without host filesystem/thread imports. No rayon feature is enabled.
- Kyomi divergence: bounded input, cooperative yielding, and server-side WASM wrapper around the
  upstream Rust API. Existing classifier text caps are preserved.
- Verification: focused encoder/classifier/config/gateway/training/backfill tests, app and ingest
  typechecks, boundary/environment checks, Compose validation, and web production build. Docker
  compilation succeeded but final image export was interrupted by the daemon becoming unavailable.
