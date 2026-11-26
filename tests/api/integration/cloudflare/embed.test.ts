import { describe, expect, test } from "bun:test";
import worker from "../../../../apps/ai-gateway/src/index";

describe("AI gateway routes", () => {
  test("keeps health available without provider credentials", async () => {
    const response = await worker.fetch(new Request("https://ai-gateway.test/health"), {
      AI: {
        run: async () => {
          throw new Error("must not call Workers AI");
        },
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("removed embeddings endpoint never invokes Workers AI", async () => {
    const response = await worker.fetch(
      new Request("https://ai-gateway.test/embed", {
        method: "POST",
        body: JSON.stringify({ input: "local embeddings only" }),
      }),
      {
        AI: {
          run: async () => {
            throw new Error("must not call Workers AI");
          },
        },
        CHAT_TOKEN: "chat-token",
      },
    );
    expect(response.status).toBe(404);
  });

  test("chat fails closed without its own secret", async () => {
    const response = await worker.fetch(
      new Request("https://ai-gateway.test/chat", {
        method: "POST",
        headers: { authorization: "Bearer translation-token" },
        body: "{}",
      }),
      {
        AI: {
          run: async () => {
            throw new Error("must not call Workers AI");
          },
        },
        TRANSLATIONS_TOKEN: "translation-token",
      },
    );
    expect(response.status).toBe(500);
  });
});
