import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/provider";
import { toastManager } from "@kyomi/ui/components/toast";
import type { TranslationResult } from "@kyomi/reader/schemas/translation";
import { requestTranslation, getTranslation } from "../lib/api";
import type { ReaderMode } from "../lib/mode";

class TranslationPendingError extends Error {}

async function translate(
  itemId: string,
  mode: ReaderMode,
  language: string | undefined,
  signal: AbortSignal,
) {
  let result = await requestTranslation({ data: { itemId, mode, language }, signal });
  const deadline = Date.now() + 120_000;
  while (result.status === "processing" || result.status === "queued") {
    if (Date.now() >= deadline) throw new TranslationPendingError();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    signal.throwIfAborted();
    result = await getTranslation({ data: { itemId, translationId: result.id }, signal });
  }
  if (result.status !== "ready" || !result.translated_content)
    throw new Error("Translation failed");
  return result;
}

// The header, floating toolbar and article body mount separately. Their QueryClient shares
// the explicit request and selected view across all three; opening an article never starts it.
export function useTranslation(
  itemId: string,
  mode: ReaderMode,
  language: string | undefined,
  version: string | null,
) {
  const client = useQueryClient();
  const { user } = useAuth();
  const key = ["reader-translation", user?.id, itemId, mode, language, version] as const;
  const query = useQuery<TranslationResult | null>({
    queryKey: key,
    enabled: false,
    retry: false,
    queryFn: ({ signal }) => translate(itemId, mode, language, signal),
  });
  async function toggle() {
    if (client.getQueryState(key)?.fetchStatus !== "idle") return;
    if (client.getQueryData(key)) {
      client.setQueryData(key, null);
      return;
    }

    await toastManager
      .promise(query.refetch({ cancelRefetch: false, throwOnError: true }), {
        loading: {
          title: "Translating your article",
          type: "loading",
          timeout: 0,
          data: { filledLoading: true },
        },
        success: { title: "Article translated", type: "success", timeout: 2400 },
        error: (error) => ({
          title:
            error instanceof TranslationPendingError
              ? "Translation pending. Try again."
              : "Translation failed. Try again.",
          type: "error",
        }),
      })
      .catch(() => undefined);
  }
  return {
    result: query.data,
    isTranslating: query.isFetching,
    label: query.isFetching
      ? "Translating article…"
      : query.data
        ? "Show original article"
        : "Translate article",
    toggle,
  };
}
