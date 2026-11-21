"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DatePicker, TimePicker } from "@/components/EventForm";
import { addDays, formatTime, isDateTimePast, todayStr } from "@/lib/dates";
import { labelWith, useI18n } from "@/lib/i18n";

export const QUICK_TYPES = ["doctor", "medicine", "exercise", "meet", "class", "other"] as const;
export type QuickType = (typeof QUICK_TYPES)[number];

export type QuickResult = {
  type: QuickType;
  place: string;
  date: string;
  time: string;
};

const inputClass =
  "w-full min-h-[56px] rounded-lg border-2 border-line bg-card px-3 py-2 text-ink";

/* ---------- "Which day?" (also used by Confirm) ---------- */

export function DayQuestion({
  labelledBy,
  onAnswer,
}: {
  labelledBy: string;
  onAnswer: (date: string) => void;
}) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(todayStr());
  const today = todayStr();

  if (picking) {
    return (
      <div className="flex flex-col gap-3">
        <DatePicker value={picked} onChange={setPicked} labelledBy={labelledBy} />
        <button type="button" onClick={() => onAnswer(picked)} aria-label={t("quick.next")} className="btn btn-primary w-full">
          {t("quick.next")}
        </button>
      </div>
    );
  }
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-3">
      <button type="button" onClick={() => onAnswer(today)} aria-label={t("quick.today")} className="btn w-full min-h-[72px]">
        {t("quick.today")}
      </button>
      <button
        type="button"
        onClick={() => onAnswer(addDays(today, 1))}
        aria-label={t("quick.tomorrow")}
        className="btn w-full min-h-[72px]"
      >
        {t("quick.tomorrow")}
      </button>
      <button type="button" onClick={() => setPicking(true)} aria-label={t("quick.pickDate")} className="btn w-full min-h-[72px]">
        <span aria-hidden="true">📅</span>
        {t("quick.pickDate")}
      </button>
    </div>
  );
}

/* ---------- "What time?" (also used by Confirm) ---------- */

const PRESETS: [string, string][] = [
  ["quick.morning", "09:00"],
  ["quick.afternoon", "14:00"],
  ["quick.evening", "18:00"],
];

export function TimeQuestion({
  date,
  labelledBy,
  onAnswer,
}: {
  date: string;
  labelledBy: string;
  onAnswer: (time: string) => void;
}) {
  const { lang, t } = useI18n();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState("09:00");
  const [pastError, setPastError] = useState(false);
  const errorId = useId();

  const choose = (time: string) => {
    if (isDateTimePast(date, time)) {
      setPastError(true);
      return;
    }
    setPastError(false);
    onAnswer(time);
  };

  const error = pastError && (
    <p id={errorId} role="alert" className="font-semibold text-danger">
      <span aria-hidden="true">⚠ </span>
      {t("form.errors.timePast")}
    </p>
  );

  if (picking) {
    return (
      <div className="flex flex-col gap-3">
        <TimePicker
          value={picked}
          onChange={(v) => {
            setPicked(v);
            setPastError(false);
          }}
          labelledBy={labelledBy}
          describedBy={pastError ? errorId : undefined}
        />
        {error}
        <button type="button" onClick={() => choose(picked)} aria-label={t("quick.next")} className="btn btn-primary w-full">
          {t("quick.next")}
        </button>
      </div>
    );
  }
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-3">
      {PRESETS.map(([key, time]) => {
        const label = `${t(key)} ${formatTime(time, lang)}`;
        return (
          <button key={key} type="button" onClick={() => choose(time)} aria-label={label} className="btn w-full min-h-[72px]">
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => {
          setPastError(false);
          setPicking(true);
        }}
        aria-label={t("quick.pickTime")}
        className="btn w-full min-h-[72px]"
      >
        <span aria-hidden="true">🕘</span>
        {t("quick.pickTime")}
      </button>
      {error}
    </div>
  );
}

/* ---------- Quick add: one question per screen ---------- */

type Props = {
  onDone: (result: QuickResult) => void;
  onCancel: () => void;
};

export default function QuickAdd({ onDone, onCancel }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<QuickType>("doctor");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(todayStr());
  // Remounts the day/time questions so "Back" always shows their first view.
  const [visit, setVisit] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const placeId = useId();

  // Move focus to the new question so screen readers read it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const goTo = (next: number) => {
    setVisit((v) => v + 1);
    setStep(next);
    window.scrollTo(0, 0);
  };

  const back = () => (step === 1 ? onCancel() : goTo(step - 1));

  const heading =
    step === 1
      ? t("quick.step1")
      : step === 2
        ? t(`quick.step2.${type}`)
        : step === 3
          ? t("quick.step3")
          : t("quick.step4");

  return (
    <main className="flex flex-col gap-5 py-4">
      <p className="font-semibold">
        {t("quick.title")} · {t("quick.stepOf", { n: step })}
      </p>
      <h1 ref={headingRef} id={headingId} tabIndex={-1} className="text-[1.6rem] font-bold">
        {heading}
      </h1>

      {step === 1 && (
        <div role="group" aria-labelledby={headingId} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {QUICK_TYPES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setType(key);
                goTo(2);
              }}
              aria-label={t(`quick.types.${key}`)}
              className="btn w-full min-h-[72px]"
            >
              {t(`quick.types.${key}`)}
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <label htmlFor={placeId} className="sr-only">
            {heading}
          </label>
          <input
            id={placeId}
            aria-label={heading}
            type="text"
            value={place}
            maxLength={100}
            onChange={(e) => setPlace(e.target.value)}
            className={inputClass}
          />
          <p>{t("quick.step2Hint")}</p>
          <button type="button" onClick={() => goTo(3)} aria-label={t("quick.next")} className="btn btn-primary w-full">
            {t("quick.next")}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlace("");
              goTo(3);
            }}
            aria-label={t("quick.skip")}
            className="btn w-full"
          >
            {t("quick.skip")}
          </button>
        </div>
      )}

      {step === 3 && (
        <DayQuestion
          key={visit}
          labelledBy={headingId}
          onAnswer={(d) => {
            setDate(d);
            goTo(4);
          }}
        />
      )}

      {step === 4 && (
        <TimeQuestion
          key={visit}
          date={date}
          labelledBy={headingId}
          onAnswer={(time) => onDone({ type, place: place.trim(), date, time })}
        />
      )}

      <button type="button" onClick={back} aria-label={labelWith(t("common.back"), t("common.backAria"))} className="btn w-full">
        <span aria-hidden="true">◀</span>
        {t("common.back")}
      </button>
    </main>
  );
}
