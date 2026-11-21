// All persistence goes through this module so it can be swapped for a database later.
import { z } from "zod";
import { isLang, type Lang } from "./i18n";
import {
  BUILT_IN_CATEGORIES,
  CategorySchema,
  EventItemSchema,
  type Category,
  type EventItem,
} from "./schema";

export type TextSize = "normal" | "large" | "xl";
export type Settings = {
  lang: Lang;
  textSize: TextSize;
  leadTimes: string[];
  sound: boolean;
};

export const LEAD_TIMES = ["0m", "-30m", "-60m", "-1d"] as const;
export const TEXT_SIZES: TextSize[] = ["normal", "large", "xl"];

export const DEFAULT_SETTINGS: Settings = {
  lang: "en",
  textSize: "normal",
  leadTimes: ["-30m", "0m"],
  sound: true,
};

const KEYS = {
  settings: "senior-schedule.settings",
  events: "senior-schedule.events",
  categories: "senior-schedule.categories",
  snoozes: "senior-schedule.snoozes",
} as const;

function readJSON(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep working in memory for this session.
  }
}

/** Returns null on first launch (nothing saved yet). */
export function loadSettings(): Settings | null {
  const data = readJSON(KEYS.settings);
  if (typeof data !== "object" || data === null) return null;
  const d = data as Partial<Settings>;
  return {
    lang: isLang(d.lang) ? d.lang : DEFAULT_SETTINGS.lang,
    textSize: TEXT_SIZES.includes(d.textSize as TextSize)
      ? (d.textSize as TextSize)
      : DEFAULT_SETTINGS.textSize,
    leadTimes: Array.isArray(d.leadTimes)
      ? d.leadTimes.filter((v): v is string =>
          (LEAD_TIMES as readonly string[]).includes(v as string),
        )
      : DEFAULT_SETTINGS.leadTimes,
    sound: typeof d.sound === "boolean" ? d.sound : DEFAULT_SETTINGS.sound,
  };
}

export function saveSettings(settings: Settings): void {
  writeJSON(KEYS.settings, settings);
}

/** Reads all saved events. Broken entries are skipped instead of breaking the app. */
export function loadEvents(): EventItem[] {
  const data = readJSON(KEYS.events);
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = EventItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function saveEvents(events: EventItem[]): void {
  writeJSON(KEYS.events, events);
}

/** Built-in categories followed by the user's own. */
export function loadCategories(): Category[] {
  const custom = z.array(CategorySchema).safeParse(readJSON(KEYS.categories));
  const own = custom.success ? custom.data.filter((c) => c.label && !c.key) : [];
  return [...BUILT_IN_CATEGORIES, ...own];
}

/** Only custom categories are stored; built-ins always come from code. */
export function saveCategories(categories: Category[]): void {
  writeJSON(
    KEYS.categories,
    categories.filter((c) => !c.key),
  );
}

const SnoozeListSchema = z.array(z.object({ eventId: z.string().min(1), at: z.number() }));
export type StoredSnooze = z.infer<typeof SnoozeListSchema>[number];

/** "Remind me in 10 minutes" entries, kept so they survive a page reload. */
export function loadSnoozes(): StoredSnooze[] {
  const parsed = SnoozeListSchema.safeParse(readJSON(KEYS.snoozes));
  return parsed.success ? parsed.data : [];
}

export function saveSnoozes(snoozes: StoredSnooze[]): void {
  writeJSON(KEYS.snoozes, snoozes);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
