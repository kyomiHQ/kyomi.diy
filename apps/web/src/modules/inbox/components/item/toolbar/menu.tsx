"use client";

import { EllipsisIcon, ExternalLinkIcon, EyeOffIcon, FlagIcon } from "@kyomi/ui/icons/blode";
import { Menu, MenuPopup, MenuTrigger } from "@kyomi/ui/components/menu";
import { ToolbarButton } from "@kyomi/ui/components/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";
import { ItemToolbarMenuItem } from "./menu-item";
import { ItemActionButton, type ItemToolbarCorners } from "./button";

const TOOLBAR_ICON_CLASS = "size-5";
const TOOLBAR_TOOLTIP_SIDE_OFFSET = 6;

export function ItemToolbarMenu({
  corners,
  onHide,
  onOpenSource,
  onReportBrokenArticle,
}: {
  corners: ItemToolbarCorners;
  onHide: () => void;
  onOpenSource: () => void;
  onReportBrokenArticle: () => void;
}) {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <ToolbarButton
                  aria-label="More"
                  render={
                    <ItemActionButton
                      corners={corners}
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    />
                  }
                >
                  <EllipsisIcon className={TOOLBAR_ICON_CLASS} />
                </ToolbarButton>
              }
            />
          }
        />
        <TooltipPopup sideOffset={TOOLBAR_TOOLTIP_SIDE_OFFSET}>More</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" sideOffset={8} className="min-w-48 rounded-xl before:rounded-[11px]">
        <ItemToolbarMenuItem label="Open source" onClick={onOpenSource}>
          <ExternalLinkIcon />
        </ItemToolbarMenuItem>
        <ItemToolbarMenuItem label="Not interested" onClick={onHide}>
          <EyeOffIcon />
        </ItemToolbarMenuItem>
        <ItemToolbarMenuItem label="Report broken article" onClick={onReportBrokenArticle}>
          <FlagIcon />
        </ItemToolbarMenuItem>
      </MenuPopup>
    </Menu>
  );
}
