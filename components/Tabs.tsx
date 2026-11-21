"use client";

import { useRef } from "react";
import { useI18n } from "@/lib/i18n";

export type TabKey = "today" | "week" | "month";
export const TAB_KEYS: TabKey[] = ["today", "week", "month"];
/** Number of days shown by each tab, counting today. */
export const TAB_DAYS: Record<TabKey, number> = { today: 1, week: 7, month: 30 };

type Props = {
  value: TabKey;
  onChange: (tab: TabKey) => void;
  panelId: string;
};

export default function Tabs({ value, onChange, panelId }: Props) {
  const { t } = useI18n();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs, as screen reader users expect.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % TAB_KEYS.length;
    if (e.key === "ArrowLeft") next = (index - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    if (next >= 0) {
      e.preventDefault();
      onChange(TAB_KEYS[next]);
      refs.current[next]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label={t("home.tabsAria")} className="grid grid-cols-3 gap-3">
      {TAB_KEYS.map((key, index) => {
        const selected = key === value;
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={selected}
            aria-controls={panelId}
            aria-label={t(`home.tab.${key}`)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`btn w-full px-2 ${
              selected ? "btn-primary underline decoration-4 underline-offset-8" : ""
            }`}
          >
            {t(`home.tab.${key}`)}
          </button>
        );
      })}
    </div>
  );
}
