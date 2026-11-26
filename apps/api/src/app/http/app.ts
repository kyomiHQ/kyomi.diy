import { Elysia } from "elysia";
import { registerErrorHandlers } from "../setup/errors";
import { registerLifecycle } from "../setup/lifecycle";
import { registerPlugins } from "../setup/plugins";
import type { AppRuntime } from "../runtime";
import { registerRoutes } from "./router";

/**
 * HTTP API on Bun/Elysia — global plugins, lifecycle, errors, route tree.
 * global plugins → lifespan → exception handling → router tree.
 *
 * The caller builds the Effect runtime before constructing the HTTP app and owns its lifetime.
 * Production boot awaits AppLive; tests supply their own Layers. Plugin registration reads the
 * initialized configuration synchronously, so it must not start an asynchronous live Layer here.
 */
export function createApp({ runtime }: { runtime: AppRuntime }) {
  const app = new Elysia({
    name: "@kyomi/api",
  });

  registerPlugins(app, runtime);
  registerLifecycle(app, { runtime, ownsRuntime: false });
  registerErrorHandlers(app, runtime);
  registerRoutes(app, runtime);

  return app;
}
