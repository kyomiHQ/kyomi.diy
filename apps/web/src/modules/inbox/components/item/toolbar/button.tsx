"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@kyomi/ui/components/button";
import { CopyIcon } from "@kyomi/ui/icons/copy";
import { ToolbarButton } from "@kyomi/ui/components/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";
import { useFeedback } from "@kyomi/ui/hooks/use-feedback";
import { useSquircle } from "@kyomi/ui/lib/squircle";
import { cn } from "@kyomi/ui/lib/utils";

const TOOLBAR_ICON_CLASS = "size-5";
const TOOLBAR_TOOLTIP_SIDE_OFFSET = 6;

export type ItemToolbarCorners = {
  cornerRadius: Parameters<typeof useSquircle>[0];
  cornerSmoothing: number;
};

export function ItemActionButton({
  corners,
  className,
  children,
  style: buttonStyle,
  ...props
}: ButtonProps & { corners: ItemToolbarCorners }) {
  const fill = useSquircle<HTMLSpanElement>(corners.cornerRadius, corners.cornerSmoothing);

  // Clip only the fill so the control keeps its hit area and outside focus ring.
  return (
    <Button
      {...props}
      className={cn(
        "group/item-action isolate size-10 hover:bg-transparent data-pressed:bg-transparent sm:size-9",
        className,
      )}
      size="icon-lg"
      style={{ ...buttonStyle, borderRadius: fill.style.borderRadius }}
      variant="ghost-muted"
    >
      <span
        ref={fill.ref}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px -z-10 transition-colors duration-(--duration-control) ease-out-quint group-hover/item-action:bg-accent group-data-pressed/item-action:bg-accent"
        style={fill.style}
      />
      {children}
    </Button>
  );
}

export function ItemToolbarButton({
  label,
  corners,
  children,
  onClick,
  active = false,
  disabled = false,
  className,
  copyFeedback = false,
}: {
  label: string;
  corners: ItemToolbarCorners;
  children?: ReactNode;
  onClick: (anchor: HTMLButtonElement) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  copyFeedback?: boolean;
}) {
  const { isActive: isCopied, showFeedback } = useFeedback();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ToolbarButton
            aria-label={label}
            render={
              <ItemActionButton
                corners={corners}
                className={cn(active && "text-foreground", className)}
                disabled={disabled}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClick(event.currentTarget);
                  if (copyFeedback) {
                    showFeedback();
                  }
                }}
              />
            }
          >
            {copyFeedback ? (
              <CopyIcon isCopied={isCopied} className={TOOLBAR_ICON_CLASS} />
            ) : (
              children
            )}
          </ToolbarButton>
        }
      />
      <TooltipPopup sideOffset={TOOLBAR_TOOLTIP_SIDE_OFFSET}>{label}</TooltipPopup>
    </Tooltip>
  );
}
