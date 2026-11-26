import { GarageAssets } from "@adapters/assets/garage";
import { Effect, Layer, ManagedRuntime, type Scope } from "effect";
import { encodeTexts } from "@kyomi/ingest";
import { Auth } from "@adapters/auth/service";
import { Db } from "@adapters/db/service";
import { HttpClientLive } from "@adapters/http/client";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { RateLimiter } from "@adapters/rate-limit/service";
import { Redis } from "@adapters/redis/service";
import { FeedSearch } from "@adapters/search/service";
import { AppConfig } from "@config/env/service";
import { FaviconResolver } from "@modules/favicon/service";
import { FeedBackground } from "@modules/feeds/service";
import { OpmlFeedsLive } from "@modules/opml/live";
import { ConfigError } from "@shared/effect/errors";

const ConfigAndLogger = Layer.mergeAll(
  AppConfig.layer,
  AppLogger.layer.pipe(Layer.provide(AppConfig.layer)),
);

const Infrastructure = Layer.mergeAll(
  // Fail boot when the required local artifact is absent or incompatible, rather than silently
  // falling back to keywords for every job. Do not validate the category head here: category:train
  // uses AppLive specifically to replace a stale head after changing the encoder.
  Layer.effectDiscard(
    Effect.tryPromise({
      try: () => encodeTexts([""]),
      catch: (cause) =>
        new ConfigError({
          message:
            "Local embedding model unavailable; run bun run --cwd packages/ingest embeddings:build",
          cause,
        }),
    }),
  ),
  Db.layer,
  Redis.layer,
  HttpClientLive,
  FeedSearch.layer.pipe(Layer.provide(HttpClientLive)),
);

/** Every service the API provides, wired once. Resources release when the layer scope closes. */
const Domains = Layer.mergeAll(
  GarageAssets,
  JobQueue.layer,
  FeedBackground.layer,
  FaviconResolver.layer,
  RateLimiter.layer,
  Auth.layer,
);

export const AppLive = Layer.provideMerge(OpmlFeedsLive, Domains).pipe(
  Layer.provideMerge(Infrastructure),
  Layer.provideMerge(ConfigAndLogger),
);

export type AppServices = Layer.Success<typeof AppLive>;
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, Layer.Error<typeof AppLive>>;

/** One runtime per process (or per test app). Dispose it to release the pool and Redis. */
export function createAppRuntime(): AppRuntime {
  return ManagedRuntime.make(AppLive);
}

/**
 * A runtime over the services the current scope already built, for Elysia's route handlers.
 * Nothing is built twice, so releasing the scope (not disposing this runtime) frees the resources.
 */
export const runtimeFromScope: Effect.Effect<AppRuntime, never, AppServices | Scope.Scope> =
  Effect.gen(function* () {
    const context = yield* Effect.context<AppServices>();
    return yield* Effect.acquireRelease(
      Effect.sync(() => ManagedRuntime.make(Layer.succeedContext(context))),
      (runtime) => Effect.promise(() => runtime.dispose()),
    );
  });
