// Calendar helpers. Dates are "YYYY-MM-DD" and times "HH:mm", both in the user's local timezone.
import { DATE_LOCALES, type Lang, type TFunc } from "./i18n";

const FALLBACK_TZ = "Asia/Kuala_Lumpur";

export function getTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock parts of an instant in a timezone. */
function zonedParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function todayStr(tz: string = getTimeZone(), now: number = Date.now()): string {
  const p = zonedParts(now, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function nowTimeStr(tz: string = getTimeZone(), now: number = Date.now()): string {
  const p = zonedParts(now, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Current local time as ISO 8601 with offset, e.g. 2026-11-21T14:05:00+08:00. */
export function nowISO(tz: string = getTimeZone(), now: number = Date.now()): string {
  const p = zonedParts(now, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMin = Math.round((asUTC - Math.floor(now / 1000) * 1000) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function parseDate(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parseDate(date);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Same day next month, clamped to the month's last day. */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = parseDate(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay)));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parseDate(a);
  const [by, bm, bd] = parseDate(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function addMinutesToTime(time: string, delta: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Converts a local date and time in a timezone to epoch milliseconds. */
export function toInstant(date: string, time: string, tz: string = getTimeZone()): number {
  const [y, mo, d] = parseDate(date);
  const [h, mi] = time.split(":").map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle the offset (and DST changes, where they exist).
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(guess, tz);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wanted - seen;
  }
  return guess;
}

export function isDatePast(date: string, tz: string = getTimeZone()): boolean {
  return date < todayStr(tz);
}

/** True when a timed event's start is already over. All-day events are only past after their day. */
export function isDateTimePast(date: string, time: string | null, tz: string = getTimeZone()): boolean {
  if (isDatePast(date, tz)) return true;
  if (time === null) return false;
  return toInstant(date, time, tz) < Date.now();
}

export function formatDate(date: string, lang: Lang): string {
  const [y, m, d] = parseDate(date);
  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatTime(time: string, lang: Lang): string {
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export function formatWhen(date: string, time: string | null, lang: Lang, t: TFunc): string {
  return `${formatDate(date, lang)}, ${time ? formatTime(time, lang) : t("time.allDay")}`;
}

export function daysLeftLabel(date: string, today: string, t: TFunc): string {
  const n = diffDays(today, date);
  if (n <= 0) return t("days.today");
  if (n === 1) return t("days.tomorrow");
  return t("days.inDays", { n });
}
