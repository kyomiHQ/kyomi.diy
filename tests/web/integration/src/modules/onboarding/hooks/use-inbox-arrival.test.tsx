// @vitest-environment jsdom

import { act, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ToastProvider, toastManager } from "@kyomi/ui/components/toast";
import { queryKeys } from "@lib/query/keys";
import { useInboxArrival } from "@modules/onboarding/hooks/use-inbox-arrival";

const requests = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  fetchInfiniteQuery: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({
    fetchQuery: requests.fetchQuery,
    fetchInfiniteQuery: requests.fetchInfiniteQuery,
    invalidateQueries: async () => {},
  }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useRouter: () => ({
    state: { location: { pathname: "/onboarding" } },
    getMatchedRoutes: () => [[], {}, {}],
    navigate: requests.navigate,
  }),
}));

vi.mock("@kyomi/ui/hooks/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

test("keeps one loading toast in sync with feed, preload, and navigation completion", async () => {
  const setup = Promise.withResolvers<void>();
  const feeds = Promise.withResolvers<void>();
  const preload = Promise.withResolvers<void>();
  const preferences = Promise.withResolvers<{ language: string }>();
  const navigation = Promise.withResolvers<void>();
  requests.fetchQuery.mockImplementation(({ queryKey }) => {
    if (queryKey === queryKeys.feeds.followed) return feeds.promise;
    if (queryKey[0] === "me") return preferences.promise;
    return Promise.resolve();
  });
  requests.fetchInfiniteQuery.mockReturnValue(preload.promise);
  requests.navigate.mockReturnValue(navigation.promise);
  const add = vi.spyOn(toastManager, "add");
  const close = vi.spyOn(toastManager, "close");
  const { result } = renderHook(() => useInboxArrival("/inbox?filter=all"), {
    wrapper: ToastProvider,
  });

  let arrival!: Promise<void>;
  act(() => {
    arrival = result.current(() => setup.promise, null);
  });
  expect(screen.getByText("Fetching feeds")).toBeTruthy();
  expect(add).toHaveBeenCalledWith(expect.objectContaining({ data: { filledLoading: true } }));

  await act(async () => setup.resolve());
  expect(screen.getByText("Fetching feeds")).toBeTruthy();
  expect(requests.fetchInfiniteQuery).toHaveBeenCalledOnce();

  await act(async () => feeds.resolve());
  expect(screen.getByText("Prepping your inbox")).toBeTruthy();
  expect(requests.navigate).not.toHaveBeenCalled();

  await act(async () => preload.resolve());
  expect(requests.fetchQuery).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: queryKeys.preferences.reader("reader") }),
  );
  expect(requests.navigate).not.toHaveBeenCalled();

  await act(async () => preferences.resolve({ language: "zh" }));
  expect(screen.getByText("Opening inbox")).toBeTruthy();
  expect(requests.navigate).toHaveBeenCalledWith({ href: "/inbox?filter=all", replace: true });
  expect(add).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();

  await act(async () => {
    navigation.resolve();
    await arrival;
  });
  expect(close).toHaveBeenCalledWith(add.mock.results[0]?.value);
});

test("closes on preload failure and ignores a later feed response", async () => {
  const feeds = Promise.withResolvers<void>();
  const failure = new Error("Inbox preload failed.");
  requests.fetchQuery.mockImplementation(({ queryKey }) =>
    queryKey === queryKeys.feeds.followed ? feeds.promise : Promise.resolve(),
  );
  requests.fetchInfiniteQuery.mockRejectedValue(failure);
  const update = vi.spyOn(toastManager, "update");
  const close = vi.spyOn(toastManager, "close");
  const { result } = renderHook(() => useInboxArrival("/inbox?filter=all"), {
    wrapper: ToastProvider,
  });

  await act(async () => {
    await expect(result.current(async () => {}, null)).rejects.toBe(failure);
  });
  expect(close).toHaveBeenCalledOnce();

  await act(async () => feeds.resolve());
  expect(update).not.toHaveBeenCalled();
  expect(requests.navigate).not.toHaveBeenCalled();
});
