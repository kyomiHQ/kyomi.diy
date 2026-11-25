import { recommendStarterBundles } from "@kyomi/ingest/ingestion/starter-bundles";
import { Item } from "@kyomi/ui/components/item";
import { usePretext, usePretextLayout } from "@kyomi/ui/hooks/use-pretext";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import "./bundle-choices.css";

// Canvas font strings for pretext; keep in step with the text-sm classes below.
const titleFont = '500 14px "Inter Variable"';
const sourceFont = '400 14px "Inter Variable"';
const lineHeight = 16;

const triggerClassName =
  "bundle-trigger flex w-full items-center justify-between gap-3 ps-3 pe-2 text-start text-sm leading-4 font-medium text-foreground";

export function BundleChoices({
  interests,
  selected,
  onSelect,
  errorId,
}: {
  interests: string[];
  selected: string[];
  onSelect?: (bundleId: string) => void;
  errorId?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const previewId = hovered ?? focused;
  const selection = new Set(selected);
  const bundles = useMemo(() => recommendStarterBundles(interests), [interests]);

  useEffect(() => {
    if (!previewId) return;

    function dismiss(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setHovered(null);
      setFocused(null);
    }

    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [previewId]);

  return (
    <fieldset
      aria-describedby={errorId}
      className="flex min-w-0 flex-col gap-2 [--bundle-trigger-height:--spacing(12)]"
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
        setHovered(event.target.closest<HTMLElement>("[data-bundle]")?.dataset.bundle ?? null);
      }}
      onPointerLeave={() => setHovered(null)}
    >
      <legend className="sr-only">Starter feed bundles</legend>
      {bundles.map((bundle) => {
        if (!onSelect) {
          return (
            <div key={bundle.id} className={triggerClassName}>
              {bundle.title}
            </div>
          );
        }

        const descriptionId = `bundle-description-${bundle.id}`;
        const sourcesId = `bundle-sources-${bundle.id}`;
        const pressed = selection.has(bundle.id);
        return (
          <Item
            key={bundle.id}
            shape="squircle"
            size="sm"
            selected={pressed}
            data-bundle={bundle.id}
            data-preview-open={previewId === bundle.id ? "" : undefined}
            className="block bg-muted/60 p-0 ring-inset duration-(--duration-control) data-selected:bg-primary/12 has-[:focus-visible]:ring-(length:--focus-ring-width) has-[:focus-visible]:ring-ring"
          >
            <button
              type="button"
              aria-label={bundle.title}
              aria-pressed={pressed}
              aria-describedby={`${descriptionId} ${sourcesId}`}
              onClick={() => onSelect(bundle.id)}
              onFocus={(event) => {
                if (!event.currentTarget.matches(":focus-visible")) return;
                setHovered(null);
                setFocused(bundle.id);
              }}
              onBlur={() => setFocused(null)}
              className={`${triggerClassName} cursor-pointer outline-none`}
            >
              <BundleTitle title={bundle.title} />
              <span
                id={descriptionId}
                className="bundle-summary text-end text-xs text-foreground/80"
              >
                {bundle.description}
              </span>
              <span id={sourcesId} className="sr-only">
                {bundle.feeds.map((feed) => feed.title).join(", ")}
              </span>
            </button>
            <ul
              aria-hidden="true"
              style={{ "--source-count": bundle.feeds.length } as CSSProperties}
              className="bundle-sources pointer-events-none text-foreground/80"
            >
              {bundle.feeds.map((feed, index) => (
                <li
                  key={feed.url}
                  style={
                    {
                      "--source-index": index,
                      "--from-end": bundle.feeds.length - index - 1,
                    } as CSSProperties
                  }
                  className="bundle-source flex h-(--source-height) items-center justify-between gap-3 ps-3 pe-2"
                >
                  <SourceName title={feed.title} />
                  <FeedFavicon
                    feedUrl={feed.url}
                    siteUrl={feed.siteUrl}
                    title={feed.title}
                    priority="low"
                    shape="squircle"
                    squircleCornerRadius={8}
                    className="bundle-source-icon size-7 border border-border bg-card"
                  />
                </li>
              ))}
            </ul>
          </Item>
        );
      })}
    </fieldset>
  );
}

function BundleTitle({ title }: { title: string }) {
  const { containerRef, fittedLabel } = usePretext({
    label: title,
    font: titleFont,
    lineHeight,
  });

  return (
    <span ref={containerRef} className="min-w-0 flex-1 truncate">
      {fittedLabel}
    </span>
  );
}

function SourceName({ title }: { title: string }) {
  const { ref, fittedWidth } = usePretextLayout({
    text: title,
    font: sourceFont,
    lineHeight,
    maxLines: 2,
  });

  return (
    <div className="min-w-0 flex-1">
      <p
        ref={ref}
        style={{ maxWidth: fittedWidth ? `${fittedWidth}px` : undefined }}
        className="bundle-source-name line-clamp-2 text-start text-sm leading-4"
      >
        {title}
      </p>
    </div>
  );
}
