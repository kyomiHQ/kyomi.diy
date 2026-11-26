// @vitest-environment jsdom
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "../../../../../../../apps/web/node_modules/@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { useTranslation } from "@modules/reader/hooks/use-translation";
import { ToastProvider, toastManager } from "@kyomi/ui/components/toast";

const { requestTranslation, getTranslation } = vi.hoisted(() => ({
  requestTranslation: vi.fn(),
  getTranslation: vi.fn(),
}));
vi.mock("@modules/reader/lib/api", () => ({ requestTranslation, getTranslation }));
vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));

test("the header translates on demand and the separately mounted reader can restore the original", async () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const useReader = () => useTranslation("article", "original", "fr-CA", null);
  const header = renderHook(useReader, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    ),
  });
  const body = renderHook(useReader, { wrapper });
  const toast = vi.spyOn(toastManager, "promise");
  requestTranslation.mockResolvedValue({ id: "translation", status: "queued" });
  getTranslation.mockResolvedValue({
    id: "translation",
    status: "ready",
    translated_content: "Texte français",
    target_language: "fr",
  });
  expect(requestTranslation).not.toHaveBeenCalled();
  let pending!: Promise<void>;
  await act(async () => {
    pending = header.result.current.toggle();
    await body.result.current.toggle();
  });
  await waitFor(() => expect(body.result.current.isTranslating).toBe(true));
  expect(screen.getByText("Translating your article")).toBeTruthy();
  expect(body.result.current.result).toBeUndefined();
  expect(toast).toHaveBeenCalledOnce();
  expect(toast).toHaveBeenCalledWith(
    expect.any(Promise),
    expect.objectContaining({
      loading: expect.objectContaining({ title: "Translating your article" }),
      success: expect.objectContaining({ title: "Article translated" }),
    }),
  );
  await act(async () => pending);
  await waitFor(() =>
    expect(body.result.current.result?.translated_content).toBe("Texte français"),
  );
  expect(screen.getByText("Article translated")).toBeTruthy();
  expect(getTranslation).toHaveBeenCalledTimes(1);
  expect(requestTranslation).toHaveBeenCalledTimes(1);
  expect(header.result.current.label).toBe("Show original article");
  await act(async () => {
    await body.result.current.toggle();
  });
  await waitFor(() => expect(header.result.current.result).toBeNull());
  expect(toast).toHaveBeenCalledOnce();
  toast.mockRestore();
  client.clear();
});

test("a translation request failure displays a short retry message", async () => {
  const client = new QueryClient();
  requestTranslation.mockRejectedValueOnce(new Error("A long server error that may overflow"));
  const { result } = renderHook(() => useTranslation("article", "original", "fr", null), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    ),
  });

  await act(async () => result.current.toggle());

  expect(await screen.findByText("Translation failed. Try again.")).toBeTruthy();
  expect(screen.queryByText(/long server error/)).toBeNull();
  client.clear();
});
