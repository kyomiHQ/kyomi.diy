import type { InboxTimestampDisplayDto, InboxTimestampHourCycleDto } from "@kyomi/reader/schemas";

function createFormatters(locale: string) {
  const locales = [locale, "en"];
  const date = (timeZone?: "UTC") =>
    new Intl.DateTimeFormat(locales, { dateStyle: "medium", timeZone });
  const dateTime = (hour12: boolean, timeZone?: "UTC") =>
    new Intl.DateTimeFormat(locales, {
      dateStyle: "medium",
      timeStyle: "short",
      hour12,
      timeZone,
    });
  return {
    dates: { local: date(), UTC: date("UTC") },
    dateTimes: {
      local: { "12h": dateTime(true), "24h": dateTime(false) },
      UTC: { "12h": dateTime(true, "UTC"), "24h": dateTime(false, "UTC") },
    },
    relativeLong: new Intl.RelativeTimeFormat(locales, { numeric: "auto" }),
    units: new Map<string, Intl.NumberFormat>(),
    locales,
  };
}

type Formatters = ReturnType<typeof createFormatters>;
const defaultFormatters = createFormatters("en");
let recentFormatters = defaultFormatters;

function getFormatters(locale: string) {
  if (locale === "en") return defaultFormatters;
  if (recentFormatters.locales[0] !== locale) recentFormatters = createFormatters(locale);
  return recentFormatters;
}

const compactUnits = {
  s: "second",
  m: "minute",
  h: "hour",
  d: "day",
  w: "week",
  mo: "month",
  y: "year",
} as const;

function formatCompactRelative(
  value: number,
  unit: keyof typeof compactUnits,
  formats: Formatters,
) {
  if (formats === defaultFormatters) return `${Math.abs(value)}${unit}`;
  let formatter = formats.units.get(unit);
  if (!formatter) {
    formatter = new Intl.NumberFormat(formats.locales, {
      style: "unit",
      unit: compactUnits[unit],
      unitDisplay: "narrow",
    });
    formats.units.set(unit, formatter);
  }
  return formatter.format(Math.abs(value));
}

/** "5 minutes ago", "yesterday", "in 2 hours": the same steps as the compact form, spelled out. */
function formatRelativeLong(date: Date, formatter: Intl.RelativeTimeFormat) {
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 3600],
    ["hour", 86_400],
    ["day", 604_800],
    ["week", 2_592_000],
    ["month", 31_536_000],
  ];
  let divisor = 1;
  for (const [unit, limit] of steps) {
    if (abs < limit) {
      return formatter.format(Math.round(diffSeconds / divisor), unit);
    }
    divisor = limit;
  }
  return formatter.format(Math.round(diffSeconds / 31_536_000), "year");
}

/** 2026-11-18 21:41 (or 9:41 PM with a 12-hour clock), in the given time zone. */
function formatIso(date: Date, hourCycle: InboxTimestampHourCycleDto, timeZone?: "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: hourCycle === "12h",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const dayPeriod = get("dayPeriod");
  const hour = hourCycle === "24h" && get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}${
    dayPeriod ? ` ${dayPeriod.toUpperCase()}` : ""
  }`;
}

function formatRelative(date: Date, formats: Formatters) {
  const diffMs = date.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return formatCompactRelative(diffSeconds, "s", formats);
  }

  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return formatCompactRelative(diffMinutes, "m", formats);
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return formatCompactRelative(diffHours, "h", formats);
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return formatCompactRelative(diffDays, "d", formats);
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return formatCompactRelative(diffWeeks, "w", formats);
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return formatCompactRelative(diffMonths, "mo", formats);
  }

  const diffYears = Math.round(diffDays / 365);
  return formatCompactRelative(diffYears, "y", formats);
}

function formatTimestamp(
  value: string,
  display: InboxTimestampDisplayDto,
  hourCycle: InboxTimestampHourCycleDto,
  locale: string,
  utc: boolean,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (display === "iso") return formatIso(date, hourCycle, utc ? "UTC" : undefined);

  const formats = getFormatters(locale);
  const zone = utc ? "UTC" : "local";
  switch (display) {
    case "relative":
      return formatRelative(date, formats);
    case "relative-long":
      return formatRelativeLong(date, formats.relativeLong);
    case "date":
      return formats.dates[zone].format(date);
    case "absolute":
      return formats.dateTimes[zone][hourCycle].format(date);
  }
}

export function formatInboxTimestamp(
  value: string,
  display: InboxTimestampDisplayDto,
  hourCycle: InboxTimestampHourCycleDto,
  locale = "en",
) {
  return formatTimestamp(value, display, hourCycle, locale, false);
}

export function formatInboxTimestampSsrFallback(
  value: string,
  display: InboxTimestampDisplayDto,
  hourCycle: InboxTimestampHourCycleDto,
  locale = "en",
) {
  return formatTimestamp(value, display, hourCycle, locale, true);
}
