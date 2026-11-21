"use client";

import EventRow from "@/components/EventRow";
import Tabs, { TAB_DAYS, type TabKey } from "@/components/Tabs";
import { addDays } from "@/lib/dates";
import { labelWith, useI18n } from "@/lib/i18n";
import type { Category, EventItem } from "@/lib/schema";

type Props = {
  events: EventItem[];
  categories: Category[];
  today: string;
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onOpenEvent: (event: EventItem) => void;
  onSpeak: () => void;
  onType: () => void;
  onQuickAdd: () => void;
};

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h1M10 10h1M14 10h1M18 10h0M7 14h10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function Home({
  events,
  categories,
  today,
  tab,
  onTabChange,
  onOpenEvent,
  onSpeak,
  onType,
  onQuickAdd,
}: Props) {
  const { t } = useI18n();
  const last = addDays(today, TAB_DAYS[tab] - 1);
  const shown = events
    .filter((e) => e.date >= today && e.date <= last)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      // All-day events come first on their day.
      return (a.time ?? "").localeCompare(b.time ?? "");
    });
  const byId = new Map(categories.map((c) => [c.id, c]));
  const panelId = "home-panel";

  return (
    <>
      {/* Bottom padding keeps the last row clear of the fixed buttons. */}
      <main className="flex flex-col gap-5 pb-[9rem] pt-4">
        <h1 className="sr-only">{t("app.name")}</h1>
        <Tabs value={tab} onChange={onTabChange} panelId={panelId} />

        <div id={panelId} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-[1.2rem] font-semibold">{t("home.empty")}</p>
              <span aria-hidden="true" className="text-[2.5rem] leading-none">
                ↓
              </span>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  category={byId.get(event.categoryId)}
                  today={today}
                  onOpen={() => onOpenEvent(event)}
                />
              ))}
            </ul>
          )}
        </div>

        <p className="rounded-lg border-2 border-line bg-card p-3">
          <span aria-hidden="true">ⓘ </span>
          {t("home.notice")}
        </p>
      </main>

      <nav aria-label={t("home.addNav")} className="fixed inset-x-0 bottom-0 border-t-2 border-line bg-page">
        <div className="mx-auto grid w-full max-w-[640px] grid-cols-3 gap-3 px-4 py-3">
          <button type="button" onClick={onSpeak} aria-label={labelWith(t("home.speak"), t("home.speakAria"))} className="btn btn-primary flex-col gap-1 px-1">
            <MicIcon />
            {t("home.speak")}
          </button>
          <button type="button" onClick={onType} aria-label={labelWith(t("home.type"), t("home.typeAria"))} className="btn btn-primary flex-col gap-1 px-1">
            <KeyboardIcon />
            {t("home.type")}
          </button>
          <button type="button" onClick={onQuickAdd} aria-label={labelWith(t("home.quick"), t("home.quickAria"))} className="btn btn-primary flex-col gap-1 px-1">
            <PlusIcon />
            {t("home.quick")}
          </button>
        </div>
      </nav>
    </>
  );
}
