"use client";

import { categoryLabel, useI18n } from "@/lib/i18n";
import { daysLeftLabel, formatWhen } from "@/lib/dates";
import type { Category, EventItem } from "@/lib/schema";

type Props = {
  event: EventItem;
  category: Category | undefined;
  today: string;
  onOpen: () => void;
};

export default function EventRow({ event, category, today, onOpen }: Props) {
  const { lang, t } = useI18n();
  const cat = categoryLabel(category, t);
  const when = formatWhen(event.date, event.time, lang, t);
  const left = daysLeftLabel(event.date, today, t);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={[event.title, cat, when, left].filter(Boolean).join(" ")}
        className="flex w-full items-start justify-between gap-3 rounded-xl border-2 border-line bg-card p-4 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span className="break-words text-[1.2rem] font-bold">{event.title}</span>{" "}
          {cat && (
            <span className="w-fit rounded-md border-2 border-line px-2 font-semibold">{cat}</span>
          )}{" "}
          <span>{when}</span>
        </span>{" "}
        <span className="shrink-0 text-right font-bold">{left}</span>
      </button>
    </li>
  );
}
