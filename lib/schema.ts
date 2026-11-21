import { z } from "zod";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const BUILT_IN_KEYS = ["health", "social", "education"] as const;
export type BuiltInKey = (typeof BUILT_IN_KEYS)[number];

export const CategorySchema = z.object({
  id: z.string().min(1),
  key: z.enum(BUILT_IN_KEYS).optional(),
  label: z.string().min(1).optional(),
});
// key = built-in (localized), label = custom
export type Category = z.infer<typeof CategorySchema>;

export const EventItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  categoryId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  time: z.string().regex(TIME_RE).nullable(),
  place: z.string().nullable(),
  createdAt: z.string(),
  source: z.enum(["voice", "text", "quick", "manual"]),
  firedReminders: z.array(z.string()),
});
export type EventItem = z.infer<typeof EventItemSchema>;
export type EventSource = EventItem["source"];

/** The editable part of an event, used by forms and the Confirm screen. */
export type EventDraft = {
  title: string;
  categoryId: string;
  date: string | null;
  time: string | null;
  allDay: boolean;
  place: string;
};

export const BUILT_IN_CATEGORIES: Category[] = BUILT_IN_KEYS.map((key) => ({ id: key, key }));

/* ---------- /api/parse ---------- */

export const MAX_PARSE_TEXT = 500;

export const ParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_PARSE_TEXT),
  lang: z.enum(["en", "ms", "zh", "ta"]),
  nowISO: z.string().min(10).max(40),
  timezone: z.string().min(1).max(64),
});
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

/** A real calendar date, not just the right shape (rejects 2026-02-30). */
const isRealDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const MISSING_FIELDS = ["title", "date", "time"] as const;
export type MissingField = (typeof MISSING_FIELDS)[number];

export const ParseResultSchema = z
  .object({
    title: z.string().max(200).nullable(),
    category: z.enum(["health", "social", "education", "other"]),
    date: z.string().regex(DATE_RE).refine(isRealDate).nullable(),
    time: z.string().regex(TIME_RE).nullable(),
    place: z.string().max(200).nullable(),
    missing: z.array(z.enum(MISSING_FIELDS)),
  })
  .transform((r) => {
    const title = (r.title ?? "").trim().slice(0, 60);
    const place = (r.place ?? "").trim() || null;
    // Anything empty is treated as missing, whatever the model reported.
    const missing = new Set<MissingField>(r.missing);
    if (!title) missing.add("title");
    if (!r.date) missing.add("date");
    if (!r.time) missing.add("time");
    return {
      title: missing.has("title") ? null : title,
      category: r.category,
      date: missing.has("date") ? null : r.date,
      time: missing.has("time") ? null : r.time,
      place,
      missing: MISSING_FIELDS.filter((f) => missing.has(f)),
    };
  });
export type ParseResult = z.infer<typeof ParseResultSchema>;
