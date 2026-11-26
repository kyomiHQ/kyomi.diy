import type { FormattedTimestamp } from "./types";

const accountTimestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
const accountRelativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function normalizeTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export function formatRelativeTimestamp(value: string, locale = "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const relative =
    locale === "en"
      ? accountRelativeFormatter
      : new Intl.RelativeTimeFormat([locale, "en"], { numeric: "auto" });
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 1) {
    return locale === "en" ? "just now" : relative.format(0, "second");
  }

  if (absMinutes < 60) {
    return relative.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return relative.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return relative.format(diffDays, "day");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return relative.format(diffWeeks, "week");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return relative.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return relative.format(diffYears, "year");
}

export function formatTimestamp(value: string, locale = "en"): FormattedTimestamp {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { absolute: "Unknown", relative: "Unknown" };
  }

  const absolute =
    locale === "en"
      ? accountTimestampFormatter
      : new Intl.DateTimeFormat([locale, "en"], { dateStyle: "medium", timeStyle: "short" });
  return {
    absolute: absolute.format(date),
    relative: formatRelativeTimestamp(value, locale),
  };
}
