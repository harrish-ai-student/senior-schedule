"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DayQuestion, TimeQuestion } from "@/components/QuickAdd";
import { formatDate, formatTime, isDateTimePast } from "@/lib/dates";
import { categoryLabel, useI18n } from "@/lib/i18n";
import type { Category, EventDraft } from "@/lib/schema";

type Props = {
  draft: EventDraft;
  categories: Category[];
  /** Original typed or spoken text, shown under the card. */
  originalText?: string;
  onSave: (draft: EventDraft) => void;
  onChange: (draft: EventDraft) => void;
};

type Question = "title" | "date" | "time";

/** Missing values are asked for one at a time; nothing is ever guessed. */
function nextQuestion(d: EventDraft): Question | null {
  if (d.title.trim() === "") return "title";
  if (d.date === null) return "date";
  if (d.time === null && !d.allDay) return "time";
  return null;
}

const inputClass =
  "w-full min-h-[56px] rounded-lg border-2 border-line bg-card px-3 py-2 text-ink";

export default function ConfirmCard({ draft: initial, categories, originalText, onSave, onChange }: Props) {
  const { lang, t } = useI18n();
  const [draft, setDraft] = useState<EventDraft>(initial);
  const [titleInput, setTitleInput] = useState("");
  const [titleError, setTitleError] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const questionId = useId();
  const titleInputId = useId();
  const titleErrorId = useId();

  const question = nextQuestion(draft);

  useEffect(() => {
    if (question) questionRef.current?.focus();
  }, [question]);

  const category = categories.find((c) => c.id === draft.categoryId);
  const notSet = <span className="italic">{t("confirm.notSet")}</span>;

  const rows: [string, React.ReactNode][] = [
    [t("confirm.name"), draft.title.trim() ? draft.title : notSet],
    [t("confirm.category"), categoryLabel(category, t) || notSet],
    [t("confirm.date"), draft.date ? formatDate(draft.date, lang) : notSet],
    [
      t("confirm.time"),
      draft.allDay ? t("time.allDay") : draft.time ? formatTime(draft.time, lang) : notSet,
    ],
  ];
  if (draft.place.trim()) rows.push([t("confirm.place"), draft.place]);

  const questionTitle =
    question === "title" ? t("confirm.askTitle") : question === "date" ? t("confirm.askDate") : t("confirm.askTime");

  return (
    <main className="flex flex-col gap-5 py-4">
      <h1 className="text-[1.6rem] font-bold">{t("confirm.title")}</h1>

      <section className="rounded-xl border-2 border-line bg-card p-5">
        <dl className="flex flex-col gap-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="font-semibold text-muted">{label}</dt>
              <dd className="break-words text-[1.3rem] font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {originalText && <p className="break-words">{t("confirm.youSaid", { text: originalText })}</p>}

      {question && (
        <section className="flex flex-col gap-3 rounded-xl border-4 border-accent bg-card p-4">
          <h2 ref={questionRef} id={questionId} tabIndex={-1} className="text-[1.5rem] font-bold">
            {questionTitle}
          </h2>

          {question === "title" && (
            <>
              <label htmlFor={titleInputId} className="sr-only">
                {questionTitle}
              </label>
              <input
                id={titleInputId}
                aria-label={questionTitle}
                type="text"
                value={titleInput}
                maxLength={100}
                onChange={(e) => {
                  setTitleInput(e.target.value);
                  setTitleError(false);
                }}
                aria-invalid={titleError}
                aria-describedby={titleError ? titleErrorId : undefined}
                className={inputClass}
              />
              {titleError && (
                <p id={titleErrorId} role="alert" className="font-semibold text-danger">
                  <span aria-hidden="true">⚠ </span>
                  {t("form.errors.name")}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!titleInput.trim()) {
                    setTitleError(true);
                    return;
                  }
                  setDraft({ ...draft, title: titleInput.trim() });
                }}
                aria-label={t("quick.next")}
                className="btn btn-primary w-full"
              >
                {t("quick.next")}
              </button>
            </>
          )}

          {question === "date" && (
            <DayQuestion
              labelledBy={questionId}
              onAnswer={(date) => {
                // A time that is already over on the chosen day must be asked again.
                const timeGone = draft.time !== null && isDateTimePast(date, draft.time);
                setDraft({ ...draft, date, time: timeGone ? null : draft.time });
              }}
            />
          )}

          {question === "time" && draft.date && (
            <TimeQuestion
              date={draft.date}
              labelledBy={questionId}
              onAnswer={(time) => setDraft({ ...draft, time })}
            />
          )}
        </section>
      )}

      <div className="flex flex-col gap-3">
        {!question && (
          <button type="button" onClick={() => onSave(draft)} aria-label={t("confirm.yes")} className="btn btn-primary w-full min-h-[72px] text-[1.2rem]">
            <span aria-hidden="true">✓</span>
            {t("confirm.yes")}
          </button>
        )}
        <button type="button" onClick={() => onChange(draft)} aria-label={t("confirm.change")} className="btn w-full">
          <span aria-hidden="true">✎</span>
          {t("confirm.change")}
        </button>
      </div>
    </main>
  );
}
