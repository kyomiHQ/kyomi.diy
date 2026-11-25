// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  RECAP_SUMMARY_LAYOUT_CLASS,
  RECAP_SUMMARY_SECTION_CLASS,
  RecapSkeleton,
} from "@modules/inbox/components/recap/sections";
import { WorthRevisiting } from "@modules/inbox/components/recap/sections/worth-revisiting";

describe("recap summary layout", () => {
  test("shows the revisit empty state without a section heading", () => {
    render(<WorthRevisiting items={[]} limit={3} onUnsave={() => {}} unsavingItemId={null} />);

    expect(screen.getByText("Nothing to revisit yet")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Worth revisiting" })).toBeNull();
  });

  test("keeps loading and populated sections on one stable full-width contract", () => {
    const { container } = render(<RecapSkeleton />);
    const layout = container.firstElementChild;

    expect(layout?.className).toBe(RECAP_SUMMARY_LAYOUT_CLASS);
    expect(RECAP_SUMMARY_LAYOUT_CLASS).toContain("w-full");
    // Sections take their natural height and the rail scrolls, instead of three clipped equal rows.
    expect(RECAP_SUMMARY_LAYOUT_CLASS).not.toContain("grid-rows");
    expect(RECAP_SUMMARY_LAYOUT_CLASS).not.toContain("max-content");
    expect(RECAP_SUMMARY_SECTION_CLASS).toContain("w-full");
    expect(RECAP_SUMMARY_SECTION_CLASS).not.toContain("h-full");
    expect(RECAP_SUMMARY_SECTION_CLASS).not.toContain("overflow-hidden");

    const sections = Array.from(layout?.children ?? []);
    expect(sections).toHaveLength(3);
    expect(sections.every((section) => section.className.includes("w-full"))).toBe(true);
    expect(new Set(sections.map((section) => section.className)).size).toBe(1);
  });
});
