# @kyomi/ingest

queue contracts, feed ingestion, favicon resolution, and the ingest-time article compiler. consumed by background jobs and both apps.

## layout

```text
src/
  services/
    queue/    Redis Stream job contracts and consumers.
    feed/     feed fetch, parse, enrich, and refresh.
    favicon/  SSRF-safe favicon resolution and browser proxy URLs.
  document/      ingest-time article compiler and its passes (Node-only, linkedom).
  enrichment/    pure helpers for the document-enrichment jobs: image size, thumbhash, embed snapshots.
  lib/           article identity, HTML entities, and feed helpers.
```

## exports

| import                                    | purpose                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@kyomi/ingest`                           | queue, feed, favicon, and helpers.                                                               |
| `@kyomi/ingest/queue`                     | job stream types and consumers.                                                                  |
| `@kyomi/ingest/ingestion`                 | feed refresh and parsing.                                                                        |
| `@kyomi/ingest/ingestion/starter-bundles` | Browser-safe catalog of onboarding feed bundles with publisher origins for favicons.             |
| `@kyomi/ingest/document`                  | `compileArticleDocument` (HTML plus KDM), `compileArticleHtml`, and the ordered compiler passes. |
| `@kyomi/ingest/enrichment`                | KDM image-measure and embed-snapshot helpers (Node).                                             |
| `@kyomi/ingest/favicon`                   | server-side favicon fetch and resolution.                                                        |
| `@kyomi/ingest/favicon/browser`           | client favicon proxy URL builder.                                                                |
| `@kyomi/ingest/lib/article-identity`      | article URL identity helpers.                                                                    |
| `@kyomi/ingest/lib/html-entities`         | HTML entity decoding.                                                                            |
| `@kyomi/ingest/lib/feed-text`             | the parser's text and URL helpers (`absoluteHttpUrl`), for scripts that must match the parser.   |

## commands

| command                                   | purpose           |
| ----------------------------------------- | ----------------- |
| `bun run --cwd packages/ingest typecheck` | type-check.       |
| `bun run --cwd packages/ingest lint`      | lint.             |
| `bun run --cwd packages/ingest fmt:check` | check formatting. |

## notes

- `apps/api` owns the executable `worker` and `scheduler` processes.
- refresh and OPML jobs use separate streams so imports don't starve scheduled refreshes.
- Article HTML policy and sanitizer live in `@kyomi/reader/sanitization` (browser-safe); `document` imports
  it plus the KDM schema from `@kyomi/reader/document`. Reader never imports ingest.
- `document` runs once at ingest. Read paths re-apply only the `@kyomi/reader/sanitization` policy, because the
  compiler's first pass strips `data-kyomi-*` hints it did not write itself.

## local embeddings

Feed and article classification share the server-only `encodeTexts` runtime in
`src/services/embeddings.ts`. It loads a compiled WebAssembly artifact once per process and produces
512-dimensional raw pooled vectors locally. The upstream model has `NORMALIZE=false`: use cosine
similarity or L2-normalize before dot-product retrieval. The existing category head normalizes its
inputs. Runtime encoding needs no network, credentials, Python, or native
inference service. Empty batches return immediately; inputs larger than 262,144 UTF-8 bytes are
rejected. Callers split long documents before encoding. Bulk calls yield between texts.

Build with Rust 1.99.1 and its `wasm32-unknown-unknown` target installed:

```sh
rustup target add wasm32-unknown-unknown
bun run --cwd packages/ingest embeddings:build
```

The first build downloads pinned source model weights into `encoders/target/ese-cache`; subsequent
builds reuse them. `encoders/dist/kyomi_encoders.wasm` is generated and ignored, and must accompany the
package in deployments. `encoders/Cargo.lock` pins build dependencies. No Cargo or model download runs
inside application request handling.

The configuration pins `encoders` 3.1.0, `bekko-static-v1-slim-100k` revision
`635eb094a82ce43f0eb882c12b31406b3d93ec26`, `mrl-512`, and `int8`. The loader verifies dimensions,
model revision, and quantization before use. `EMBEDDING_MODEL_ID` identifies this embedding space;
changing it requires re-embedding cached texts and retraining the category head. BGE-M3 vectors and
classifier weights are incompatible. Model weights use the MIT license; encoders code is Apache-2.0.

Primary references (accessed 2026-11-25):
[encoders 3.1.0 contract](https://docs.rs/encoders/3.1.0/encoders/),
[model catalog and quality limitations](https://github.com/flowercomputers/encoders#bekko-models).
Static token averaging loses word order and contextual meaning; category accuracy and feed-ranking
quality need task-specific evaluation, independently of runtime speed.
