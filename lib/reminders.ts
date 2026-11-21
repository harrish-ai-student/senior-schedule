// Client-side reminder scheduler. No UI code here, so a Web Push implementation can replace it later.
import { getTimeZone, toInstant } from "./dates";
import type { EventItem } from "./schema";

export const CHECK_INTERVAL_MS = 20_000;
/** Reminders missed while the app was closed are still shown if they are this recent. */
export const CATCH_UP_MS = 30 * 60_000;
export const SNOOZE_MS = 10 * 60_000;
/** All-day events are treated as starting at this local time. */
export const ALL_DAY_TIME = "08:00";

export type Snooze = { eventId: string; at: number };

export type Reminder = {
  /** Stable id for this alert, used to avoid showing it twice. */
  id: string;
  eventId: string;
  /** Lead-time keys this alert covers, e.g. ["-30m"]; all get marked done together. */
  keys: string[];
  /** Set when this alert comes from "Remind me in 10 minutes". */
  snoozeAt?: number;
  dueAt: number;
};

const LEAD_MS: Record<string, number> = {
  "0m": 0,
  "-30m": 30 * 60_000,
  "-60m": 60 * 60_000,
  "-1d": 24 * 60 * 60_000,
};

/** Lead times that apply to an event. All-day events only use "at the time" (08:00) and "1 day before". */
function leadsFor(event: EventItem, leadTimes: string[]): string[] {
  const valid = leadTimes.filter((k) => k in LEAD_MS);
  return event.time === null ? valid.filter((k) => k === "0m" || k === "-1d") : valid;
}

/**
 * Pure check: which reminders are due at `now`. A reminder is due once its time
 * has come, at most CATCH_UP_MS ago, and it is not in `firedReminders`.
 * Several due lead times of one event become one alert.
 */
export function dueReminders(
  events: EventItem[],
  leadTimes: string[],
  snoozes: Snooze[],
  now: number,
  tz: string = getTimeZone(),
): Reminder[] {
  const out: Reminder[] = [];
  const byId = new Map(events.map((e) => [e.id, e]));

  for (const event of events) {
    const start = toInstant(event.date, event.time ?? ALL_DAY_TIME, tz);
    const created = Date.parse(event.createdAt);
    const keys: string[] = [];
    let latest = 0;
    for (const key of leadsFor(event, leadTimes)) {
      if (event.firedReminders.includes(key)) continue;
      const dueAt = start - LEAD_MS[key];
      // Skip reminders whose time had already passed when the event was created.
      if (!Number.isNaN(created) && dueAt < created) continue;
      if (now >= dueAt && now - dueAt <= CATCH_UP_MS) {
        keys.push(key);
        latest = Math.max(latest, dueAt);
      }
    }
    if (keys.length > 0) {
      out.push({ id: `${event.id}|${keys.join(",")}|${latest}`, eventId: event.id, keys, dueAt: latest });
    }
  }

  for (const s of snoozes) {
    if (!byId.has(s.eventId)) continue;
    if (now >= s.at && now - s.at <= CATCH_UP_MS) {
      out.push({ id: `${s.eventId}|snooze|${s.at}`, eventId: s.eventId, keys: [], snoozeAt: s.at, dueAt: s.at });
    }
  }

  return out.sort((a, b) => a.dueAt - b.dueAt);
}

/** Marks lead times as fired on an event. */
export function markFired(event: EventItem, keys: string[]): EventItem {
  if (keys.length === 0) return event;
  return { ...event, firedReminders: Array.from(new Set([...event.firedReminders, ...keys])) };
}

/** Drops snoozes that are for deleted events or too old to show. */
export function pruneSnoozes(snoozes: Snooze[], events: EventItem[], now: number): Snooze[] {
  const ids = new Set(events.map((e) => e.id));
  return snoozes.filter((s) => ids.has(s.eventId) && now - s.at <= CATCH_UP_MS);
}

type EngineOptions = {
  getState: () => { events: EventItem[]; leadTimes: string[]; snoozes: Snooze[] };
  /** Called with reminders that became due and have not been handed out yet. */
  onDue: (reminders: Reminder[]) => void;
  intervalMs?: number;
};

/**
 * Checks right away (catching up on recent missed reminders) and then every 20 seconds.
 * Each reminder is handed out once per page load; it stays out of `firedReminders`
 * until the user acknowledges it, so a reload while an alert is open shows it again.
 * Returns a function that stops the engine.
 */
export function startReminderEngine({ getState, onDue, intervalMs = CHECK_INTERVAL_MS }: EngineOptions): () => void {
  const handedOut = new Set<string>();
  const check = () => {
    const { events, leadTimes, snoozes } = getState();
    const fresh = dueReminders(events, leadTimes, snoozes, Date.now()).filter((r) => !handedOut.has(r.id));
    if (fresh.length === 0) return;
    fresh.forEach((r) => handedOut.add(r.id));
    onDue(fresh);
  };
  check();
  const id = window.setInterval(check, intervalMs);
  // Timers are slowed in background tabs; check again as soon as the page is visible.
  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
