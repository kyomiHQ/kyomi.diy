"use client";

import type { InboxTimestampDisplayDto, InboxTimestampHourCycleDto } from "@kyomi/reader/schemas";
import { useHydrated } from "@hooks/use-hydrated";
import { usePreferredLocale } from "@lib/locale";
import {
  formatInboxTimestamp,
  formatInboxTimestampSsrFallback,
} from "@modules/articles/lib/format-timestamp";

type TimestampProps = {
  value: string;
  display: InboxTimestampDisplayDto;
  hourCycle: InboxTimestampHourCycleDto;
};

export function Timestamp({ value, display, hourCycle }: TimestampProps) {
  const hydrated = useHydrated();
  const locale = usePreferredLocale();
  const formattedValue = hydrated
    ? formatInboxTimestamp(value, display, hourCycle, locale)
    : formatInboxTimestampSsrFallback(value, display, hourCycle, locale);

  return (
    <time dateTime={value} lang={display === "iso" ? undefined : locale} suppressHydrationWarning>
      {formattedValue}
    </time>
  );
}
