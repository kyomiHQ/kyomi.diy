"use client";

import { useState } from "react";
import type { InboxItem } from "@modules/articles/lib/api";
import { useItemToolbarModel } from "@modules/inbox/hooks/use-item-toolbar";
import { ReportArticleDialog } from "../report-article";
import { ItemToolbar } from "./index";
import type { ItemToolbarCorners } from "./button";

export function ItemInlineToolbar({
  item,
  corners,
}: {
  item: InboxItem;
  corners: ItemToolbarCorners;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const toolbar = useItemToolbarModel({
    item,
    onReportBrokenArticle: () => setReportOpen(true),
  });

  return (
    <>
      <ItemToolbar {...toolbar.toolbarProps} corners={corners} />
      <ReportArticleDialog item={item} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
