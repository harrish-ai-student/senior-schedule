"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmCard from "@/components/ConfirmCard";
import EventForm from "@/components/EventForm";
import Home from "@/components/Home";
import LanguagePicker from "@/components/LanguagePicker";
import ReminderAlert from "@/components/ReminderAlert";
import QuickAdd, { type QuickResult, type QuickType } from "@/components/QuickAdd";
import Settings from "@/components/Settings";
import SpeakScreen from "@/components/SpeakScreen";
import TypeScreen from "@/components/TypeScreen";
import type { TabKey } from "@/components/Tabs";
import { addDays, addMinutesToTime, formatWhen, isDateTimePast, nowTimeStr, todayStr } from "@/lib/dates";
import {
  SNOOZE_MS,
  markFired,
  pruneSnoozes,
  startReminderEngine,
  type Reminder,
  type Snooze,
} from "@/lib/reminders";
import { I18nContext, labelWith, translate, type I18nValue, type Lang } from "@/lib/i18n";
import type { Category, EventDraft, EventItem, EventSource, ParseResult } from "@/lib/schema";
import {
  DEFAULT_SETTINGS,
  TEXT_SIZES,
  loadCategories,
  loadEvents,
  loadSettings,
  loadSnoozes,
  newId,
  saveCategories,
  saveEvents,
  saveSettings,
  saveSnoozes,
  type Settings as SettingsType,
} from "@/lib/storage";

type Screen =
  | { name: "home" }
  | { name: "quick" }
  | { name: "type" }
  | { name: "speak" }
  | { name: "confirm"; draft: EventDraft; source: EventSource; originalText?: string }
  | {
      name: "form";
      mode: "add" | "edit";
      eventId?: string;
      draft: EventDraft;
      source: EventSource;
      message?: string;
    };

/** Header screens shown on top of the current screen, which stays mounted underneath. */
type Overlay = "settings" | "language" | null;

const QUICK_CATEGORY: Record<QuickType, string | null> = {
  doctor: "health",
  medicine: "health",
  exercise: "health",
  meet: "social",
  class: "education",
  other: null, // a custom "Other" category
};

const ROOT_FONT_SIZE: Record<SettingsType["textSize"], string> = {
  normal: "20px",
  large: "24px",
  xl: "28px",
};

function Header({
  settings,
  onLanguage,
  onTextSize,
  onSettings,
}: {
  settings: SettingsType;
  onLanguage: () => void;
  onTextSize: () => void;
  onSettings: () => void;
}) {
  const t = (key: string, vars?: Record<string, string>) => translate(settings.lang, key, vars);
  const idx = TEXT_SIZES.indexOf(settings.textSize);
  const next = TEXT_SIZES[(idx + 1) % TEXT_SIZES.length];
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line py-3">
      <p className="text-[1.4rem] font-bold">{t("app.name")}</p>
      <nav aria-label={t("header.navAria")} className="flex flex-wrap gap-3">
        <button type="button" onClick={onLanguage} aria-label={labelWith(t("language.button"), t("language.buttonAria"))} className="btn">
          <span aria-hidden="true">🌐</span>
          {t("language.button")}
        </button>
        <button
          type="button"
          onClick={onTextSize}
          aria-label={labelWith(
            t("header.textSize"),
            t("header.textSizeAria", {
              size: t(`textSize.${settings.textSize}`),
              next: t(`textSize.${next}`),
            }),
          )}
          className="btn"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 19 8 5l5 14M4.8 14h6.4M14 19l3.5-9 3.5 9M15.2 16h4.6" />
          </svg>
          {t("header.textSize")}
        </button>
        <button type="button" onClick={onSettings} aria-label={labelWith(t("header.settings"), t("header.settingsAria"))} className="btn">
          <span aria-hidden="true">⚙</span>
          {t("header.settings")}
        </button>
      </nav>
    </header>
  );
}

/** A new event starts today at the next whole hour (tomorrow 09:00 late at night). */
function newDraft(): EventDraft {
  const today = todayStr();
  const now = nowTimeStr();
  const nextHour = addMinutesToTime(`${now.slice(0, 2)}:00`, 60);
  const lateNight = now >= "23:00";
  return {
    title: "",
    categoryId: "health",
    date: lateNight ? addDays(today, 1) : today,
    time: lateNight ? "09:00" : nextHour,
    allDay: false,
    place: "",
  };
}

function draftFromEvent(e: EventItem): EventDraft {
  return {
    title: e.title,
    categoryId: e.categoryId,
    date: e.date,
    time: e.time,
    allDay: e.time === null,
    place: e.place ?? "",
  };
}

export default function Page() {
  // undefined = not read yet, null = first launch.
  const [settings, setSettings] = useState<SettingsType | null | undefined>(undefined);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tab, setTab] = useState<TabKey>("today");
  const [today, setToday] = useState<string>("");
  const [snoozes, setSnoozes] = useState<Snooze[]>([]);
  /** Reminders waiting to be shown; the first one is on screen. */
  const [alerts, setAlerts] = useState<Reminder[]>([]);

  useEffect(() => {
    setSettings(loadSettings());
    const loadedEvents = loadEvents();
    setEvents(loadedEvents);
    setCategories(loadCategories());
    const loadedSnoozes = pruneSnoozes(loadSnoozes(), loadedEvents, Date.now());
    setSnoozes(loadedSnoozes);
    saveSnoozes(loadedSnoozes);
    setToday(todayStr());
    // Keeps "today" correct when the page stays open past midnight.
    const id = window.setInterval(() => setToday(todayStr()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const lang: Lang = settings?.lang ?? DEFAULT_SETTINGS.lang;
  const textSize = settings?.textSize ?? DEFAULT_SETTINGS.textSize;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, "app.name");
  }, [lang]);

  useEffect(() => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE[textSize];
  }, [textSize]);

  // Each new screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, overlay]);

  // The reminder engine reads the latest data through this ref.
  const latest = useRef({ events, snoozes, leadTimes: settings?.leadTimes ?? [], lang });
  useEffect(() => {
    latest.current = { events, snoozes, leadTimes: settings?.leadTimes ?? [], lang };
  });

  const ready = settings !== undefined && settings !== null;
  useEffect(() => {
    if (!ready) return;
    return startReminderEngine({
      getState: () => latest.current,
      onDue: (due) => {
        setAlerts((queue) => [...queue, ...due]);
        // Also show a system notification if the user allowed it.
        if ("Notification" in window && Notification.permission === "granted") {
          const { events: evs, lang: l } = latest.current;
          const tl = (key: string, vars?: Record<string, string | number>) => translate(l, key, vars);
          for (const r of due) {
            const ev = evs.find((e) => e.id === r.eventId);
            if (!ev) continue;
            try {
              new Notification(ev.title, { body: formatWhen(ev.date, ev.time, l, tl), tag: r.id });
            } catch {
              // Some mobile browsers only allow notifications from a service worker; the on-screen alert still shows.
            }
          }
        }
      },
    });
  }, [ready]);

  const updateSettings = useCallback((next: SettingsType) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const updateEvents = useCallback((next: EventItem[]) => {
    setEvents(next);
    saveEvents(next);
  }, []);

  const addCategory = useCallback(
    (label: string): Category => {
      const existing = categories.find(
        (c) => c.label && c.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
      );
      if (existing) return existing;
      const cat: Category = { id: newId(), label };
      const next = [...categories, cat];
      setCategories(next);
      saveCategories(next);
      return cat;
    },
    [categories],
  );

  const i18n = useMemo<I18nValue>(
    () => ({ lang, t: (key, vars) => translate(lang, key, vars) }),
    [lang],
  );

  if (settings === undefined) return null;

  const goHome = () => setScreen({ name: "home" });

  const saveDraft = (draft: EventDraft, source: EventSource, eventId?: string) => {
    if (!draft.date) return;
    const date = draft.date;
    const time = draft.allDay ? null : draft.time;
    const place = draft.place.trim() || null;
    const existing = eventId ? events.find((e) => e.id === eventId) : undefined;
    if (existing) {
      const moved = existing.date !== date || existing.time !== time;
      updateEvents(
        events.map((e) =>
          e.id === existing.id
            ? {
                ...e,
                title: draft.title,
                categoryId: draft.categoryId,
                date,
                time,
                place,
                // A new date or time needs its reminders again.
                firedReminders: moved ? [] : e.firedReminders,
              }
            : e,
        ),
      );
    } else {
      updateEvents([
        ...events,
        {
          id: newId(),
          title: draft.title,
          categoryId: draft.categoryId,
          date,
          time,
          place,
          createdAt: new Date().toISOString(),
          source,
          firedReminders: [],
        },
      ]);
    }
    goHome();
  };

  /** The custom "Other" category, created the first time it is needed. */
  const otherCategoryId = () => addCategory(translate(lang, "category.other")).id;

  const fromQuick = (r: QuickResult) =>
    setScreen({
      name: "confirm",
      source: "quick",
      draft: {
        title: translate(lang, `quick.defaultTitle.${r.type}`),
        categoryId: QUICK_CATEGORY[r.type] ?? otherCategoryId(),
        date: r.date,
        time: r.time,
        allDay: false,
        place: r.place,
      },
    });

  /** Turns an AI result into a Confirm screen. Missing or past values are asked for there. */
  const fromParse = (r: ParseResult, text: string, source: EventSource) => {
    const categoryId = r.category === "other" ? otherCategoryId() : r.category;
    // A date and time already in the past is treated as a missing date.
    const past = r.date !== null && isDateTimePast(r.date, r.time);
    setScreen({
      name: "confirm",
      source,
      originalText: text,
      draft: {
        title: r.title ?? "",
        categoryId,
        date: past ? null : r.date,
        time: r.time,
        allDay: false,
        place: r.place ?? "",
      },
    });
  };

  /** AI failed or timed out: open the Manual form with the text as the event name. */
  const parseFailed = (text: string, source: EventSource) =>
    setScreen({
      name: "form",
      mode: "add",
      source,
      draft: { ...newDraft(), title: text },
      message: translate(lang, "type.failed"),
    });

  const updateSnoozes = (next: Snooze[]) => {
    setSnoozes(next);
    saveSnoozes(next);
  };

  // Drop alerts for events that were deleted meanwhile.
  const activeAlerts = alerts.filter((a) => events.some((e) => e.id === a.eventId));
  const currentAlert = activeAlerts[0];
  const alertEvent = currentAlert && events.find((e) => e.id === currentAlert.eventId);

  /** Closes the current alert: marks its reminders done and optionally snoozes it. */
  const closeAlert = (snooze: boolean) => {
    if (!currentAlert) return;
    updateEvents(events.map((e) => (e.id === currentAlert.eventId ? markFired(e, currentAlert.keys) : e)));
    let nextSnoozes = snoozes.filter(
      (s) => !(s.eventId === currentAlert.eventId && s.at === currentAlert.snoozeAt),
    );
    if (snooze) nextSnoozes = [...nextSnoozes, { eventId: currentAlert.eventId, at: Date.now() + SNOOZE_MS }];
    updateSnoozes(nextSnoozes);
    setAlerts((queue) => queue.filter((a) => a.id !== currentAlert.id));
  };

  let content: React.ReactNode;
  if (settings === null) {
    content = (
      <LanguagePicker
        current={null}
        onPick={(picked) => updateSettings({ ...DEFAULT_SETTINGS, lang: picked })}
      />
    );
  } else {
    let body: React.ReactNode;
    if (screen.name === "speak") {
      body = (
        <SpeakScreen
          onResult={(r, text) => fromParse(r, text, "voice")}
          onFailure={(text) => parseFailed(text, "voice")}
          onUseType={() => setScreen({ name: "type" })}
          onCancel={goHome}
        />
      );
    } else if (screen.name === "type") {
      body = (
        <TypeScreen
          onResult={(r, text) => fromParse(r, text, "text")}
          onFailure={(text) => parseFailed(text, "text")}
          onBack={goHome}
        />
      );
    } else if (screen.name === "quick") {
      body = <QuickAdd onDone={fromQuick} onCancel={goHome} />;
    } else if (screen.name === "confirm") {
      const { source } = screen;
      body = (
        <ConfirmCard
          draft={screen.draft}
          categories={categories}
          originalText={screen.originalText}
          onSave={(draft) => saveDraft(draft, source)}
          onChange={(draft) => setScreen({ name: "form", mode: "add", draft, source })}
        />
      );
    } else if (screen.name === "form") {
      body = (
        <EventForm
          key={screen.eventId ?? "new"}
          mode={screen.mode}
          initial={screen.draft}
          categories={categories}
          message={screen.message}
          onAddCategory={addCategory}
          onSave={(draft) => saveDraft(draft, screen.source, screen.eventId)}
          onCancel={goHome}
          onDelete={
            screen.eventId
              ? () => {
                  updateEvents(events.filter((e) => e.id !== screen.eventId));
                  goHome();
                }
              : undefined
          }
        />
      );
    } else {
      body = (
        <Home
          events={events}
          categories={categories}
          today={today}
          tab={tab}
          onTabChange={setTab}
          onOpenEvent={(e) =>
            setScreen({ name: "form", mode: "edit", eventId: e.id, draft: draftFromEvent(e), source: e.source })
          }
          onSpeak={() => setScreen({ name: "speak" })}
          onType={() => setScreen({ name: "type" })}
          onQuickAdd={() => setScreen({ name: "quick" })}
        />
      );
    }

    content = (
      <>
        <Header
          settings={settings}
          onLanguage={() => setOverlay("language")}
          onTextSize={() => {
            const idx = TEXT_SIZES.indexOf(settings.textSize);
            updateSettings({ ...settings, textSize: TEXT_SIZES[(idx + 1) % TEXT_SIZES.length] });
          }}
          onSettings={() => setOverlay("settings")}
        />
        {overlay === "language" && (
          <LanguagePicker
            current={settings.lang}
            onPick={(picked) => {
              updateSettings({ ...settings, lang: picked });
              setOverlay(null);
            }}
            onBack={() => setOverlay(null)}
          />
        )}
        {overlay === "settings" && (
          <Settings settings={settings} onChange={updateSettings} onDone={() => setOverlay(null)} />
        )}
        {/* The current screen stays mounted while an overlay is open, so nothing typed is lost. */}
        <div hidden={overlay !== null}>{body}</div>
      </>
    );
  }

  return (
    <I18nContext.Provider value={i18n}>
      {/* While a reminder is showing, the app underneath cannot be reached. */}
      <div className="mx-auto w-full max-w-[640px] px-4" inert={alertEvent ? true : undefined}>
        {content}
      </div>
      {alertEvent && currentAlert && (
        <ReminderAlert
          key={currentAlert.id}
          title={alertEvent.title}
          when={formatWhen(alertEvent.date, alertEvent.time, lang, i18n.t)}
          sound={settings?.sound ?? true}
          onOk={() => closeAlert(false)}
          onSnooze={() => closeAlert(true)}
        />
      )}
    </I18nContext.Provider>
  );
}
