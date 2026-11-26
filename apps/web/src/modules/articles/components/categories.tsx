import type { ComponentProps } from "react";
import { useSquircle } from "@kyomi/ui/lib/squircle";
import { cn } from "@kyomi/ui/lib/utils";

const MAX_VISIBLE_CHIPS = 2;

type CategoriesProps = {
  categories: string[];
  /** Meta font size in px, kept in sync with the footer's saved chip and timestamp. */
  fontSizePx: number;
  className?: string;
  corners?: { cornerRadius: Parameters<typeof useSquircle>[0]; cornerSmoothing: number };
};

/**
 * Renders up to two category chips in the feed item footer. Overflow beyond two is
 * summarized as a `+N` chip with an accessible label listing the hidden categories.
 */
export function Categories({ categories, fontSizePx, className, corners }: CategoriesProps) {
  if (categories.length === 0) {
    return null;
  }

  const visible = categories.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = categories.slice(MAX_VISIBLE_CHIPS);

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {visible.map((category) => (
        <CategoryChip
          key={category}
          className="min-w-0 shrink truncate"
          corners={corners}
          fontSizePx={fontSizePx}
        >
          {category}
        </CategoryChip>
      ))}
      {overflow.length > 0 ? (
        <CategoryChip
          aria-label={`${overflow.length} more categories: ${overflow.join(", ")}`}
          title={overflow.join(", ")}
          className="shrink-0 tabular-nums"
          corners={corners}
          fontSizePx={fontSizePx}
        >
          +{overflow.length}
        </CategoryChip>
      ) : null}
    </div>
  );
}

function CategoryChip({
  className,
  corners,
  fontSizePx,
  ...props
}: ComponentProps<"span"> & Pick<CategoriesProps, "corners" | "fontSizePx">) {
  const squircle = useSquircle<HTMLSpanElement>(
    corners?.cornerRadius ?? 0,
    corners?.cornerSmoothing,
  );

  return (
    <span
      {...props}
      ref={corners ? squircle.ref : undefined}
      className={cn(
        "rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground/85",
        className,
      )}
      style={{ ...(corners && squircle.style), fontSize: `${fontSizePx}px` }}
    />
  );
}
