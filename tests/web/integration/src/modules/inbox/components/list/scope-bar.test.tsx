import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ListHeader } from "@modules/inbox/components/list/scope-bar";

const LONG_FEED_NAME = "Al Jazeera – Breaking News, World News and Video from Al Jazeera";
const noop = () => {};

function renderFeedHeader(feedLabel: string) {
  return render(
    <ListHeader
      backAction={noop}
      feedLabel={feedLabel}
      filter="all"
      isArticleScoped={false}
      isLoading={false}
      pinnedFolders={[]}
      showScopedHeader
      onFilterChange={noop}
      onSortChange={noop}
    />,
  );
}

afterEach(() => vi.restoreAllMocks());

test("exposes the full feed name when the visible label clips", async () => {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("truncate") ? 520 : 0;
    },
  );
  renderFeedHeader(LONG_FEED_NAME);

  const trigger = await screen.findByRole("button", {
    name: `Show full feed name: ${LONG_FEED_NAME}`,
  });
  fireEvent.click(trigger);
  expect(await screen.findByRole("dialog", { name: LONG_FEED_NAME })).toBeTruthy();
});

test("renders a fitting name without a disclosure", () => {
  renderFeedHeader("Al Jazeera");

  expect(screen.getByText("Al Jazeera")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /show full feed name/i })).toBeNull();
});
