"use client";

import type { ToastObject } from "@base-ui/react/toast";
import { Toast } from "@base-ui/react/toast";
import type React from "react";
import { TextMorph } from "../text-morph";
import { getToastProgress } from "./progress";

type ToastData = ToastObject<Record<string, unknown>>;

// Match the icon handoff for promise results. Progress uses the same timing as its ring and count.
const TITLE_MORPH_DURATION_MS = 600;
const TITLE_MORPH_EASE = "cubic-bezier(0.41, 1.03, 0.6, 1.03)";

/** The toast's title, morphing in place when a loading toast settles into success or error. */
export function ToastTitle({
  toast,
  ...props
}: Omit<Toast.Title.Props, "children"> & { toast: ToastData }): React.ReactElement | null {
  const progress = getToastProgress(toast);
  return toast.title ? (
    <Toast.Title {...props}>
      <TextMorph
        duration={progress ? undefined : TITLE_MORPH_DURATION_MS}
        ease={progress ? undefined : TITLE_MORPH_EASE}
      >
        {toast.title}
      </TextMorph>
    </Toast.Title>
  ) : null;
}
