"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  addDays,
  addMinutesToTime,
  addMonths,
  formatDate,
  formatTime,
  isDatePast,
  isDateTimePast,
  todayStr,
} from "@/lib/dates";
import { categoryLabel, labelWith, useI18n } from "@/lib/i18n";
import type { Category, EventDraft } from "@/lib/schema";

const inputClass =
  "w-full min-h-[56px] rounded-lg border-2 border-line bg-card px-3 py-2 text-ink";

/* ---------- Large date picker (also used by Quick add and Confirm) ---------- */

export function DatePicker({
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  value: string;
  onChange: (date: string) => void;
  labelledBy?: string;
  describedBy?: string;
}) {
  const { lang, t } = useI18n();
  const min = todayStr();
  // Never step to a day before today.
  const go = (next: string) => onChange(next < min ? min : next);
  const atMin = value <= min;
  const steps: [string, string, () => string, () => string][] = [
    ["datePicker.prevDay", "datePicker.nextDay", () => addDays(value, -1), () => addDays(value, 1)],
    ["datePicker.prevWeek", "datePicker.nextWeek", () => addDays(value, -7), () => addDays(value, 7)],
    ["datePicker.prevMonth", "datePicker.nextMonth", () => addMonths(value, -1), () => addMonths(value, 1)],
  ];
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex flex-col gap-3">
      <p aria-live="polite" className="rounded-lg border-2 border-line bg-card p-3 text-center text-[1.4rem] font-bold">
        {formatDate(value, lang)}
      </p>
      {steps.map(([prevKey, nextKey, prev, next]) => (
        <div key={prevKey} className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={atMin}
            onClick={() => go(prev())}
            aria-label={t(prevKey)}
            className="btn w-full px-2"
          >
            <span aria-hidden="true">◀</span>
            {t(prevKey)}
          </button>
          <button type="button" onClick={() => go(next())} aria-label={t(nextKey)} className="btn w-full px-2">
            {t(nextKey)}
            <span aria-hidden="true">▶</span>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Large time picker (also used by Quick add and Confirm) ---------- */

export function TimePicker({
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  value: string;
  onChange: (time: string) => void;
  labelledBy?: string;
  describedBy?: string;
}) {
  const { lang, t } = useI18n();
  const steps: [string, string, number][] = [
    ["timePicker.hourEarlier", "timePicker.hourLater", 60],
    ["timePicker.minEarlier", "timePicker.minLater", 5],
  ];
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex flex-col gap-3">
      <p aria-live="polite" className="rounded-lg border-2 border-line bg-card p-3 text-center text-[1.8rem] font-bold">
        {formatTime(value, lang)}
      </p>
      {steps.map(([earlierKey, laterKey, minutes]) => (
        <div key={earlierKey} className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange(addMinutesToTime(value, -minutes))}
            aria-label={t(earlierKey)}
            className="btn w-full px-2"
          >
            <span aria-hidden="true">−</span>
            {t(earlierKey)}
          </button>
          <button
            type="button"
            onClick={() => onChange(addMinutesToTime(value, minutes))}
            aria-label={t(laterKey)}
            className="btn w-full px-2"
          >
            <span aria-hidden="true">+</span>
            {t(laterKey)}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Delete confirmation dialog ---------- */

function ConfirmDeleteDialog({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const { t } = useI18n();
  const noRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    noRef.current?.focus();
  }, []);

  // Keep keyboard focus inside the dialog; Escape keeps the event.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onNo();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === noRef.current ? yesRef : noRef).current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-[600px] flex-col gap-4 rounded-xl border-2 border-line bg-card p-6"
      >
        <h2 id={titleId} className="text-[1.4rem] font-bold">
          {t("confirmDelete.title")}
        </h2>
        <button ref={yesRef} type="button" onClick={onYes} aria-label={t("confirmDelete.yes")} className="btn btn-danger w-full">
          {t("confirmDelete.yes")}
        </button>
        <button ref={noRef} type="button" onClick={onNo} aria-label={t("confirmDelete.no")} className="btn w-full">
          {t("confirmDelete.no")}
        </button>
      </div>
    </div>
  );
}

/* ---------- Manual form ---------- */

type Props = {
  mode: "add" | "edit";
  initial: EventDraft;
  categories: Category[];
  /** A message that stays until the user leaves, e.g. after the AI could not read the text. */
  message?: string;
  onAddCategory: (label: string) => Category;
  onSave: (draft: EventDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

const DEFAULT_TIME = "09:00";

export default function EventForm({
  mode,
  initial,
  categories,
  message,
  onAddCategory,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial.title);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [date, setDate] = useState(initial.date ?? todayStr());
  const [time, setTime] = useState(initial.time ?? DEFAULT_TIME);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [place, setPlace] = useState(initial.place);
  const [submitted, setSubmitted] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newCatError, setNewCatError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const ids = {
    name: useId(),
    nameErr: useId(),
    cat: useId(),
    catErr: useId(),
    newCat: useId(),
    newCatErr: useId(),
    date: useId(),
    dateErr: useId(),
    time: useId(),
    timeErr: useId(),
    place: useId(),
  };

  const errors = {
    name: title.trim() === "",
    category: !categories.some((c) => c.id === categoryId),
    date: isDatePast(date),
    time: !allDay && !isDatePast(date) && isDateTimePast(date, time),
  };
  const show = (key: keyof typeof errors) => submitted && errors[key];

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({
      title: title.trim(),
      categoryId,
      date,
      time: allDay ? null : time,
      allDay,
      place: place.trim(),
    });
  };

  const addCategory = () => {
    const label = newCat.trim();
    if (!label) {
      setNewCatError(true);
      return;
    }
    const cat = onAddCategory(label);
    setCategoryId(cat.id);
    setAddingCat(false);
    setNewCat("");
    setNewCatError(false);
  };

  const errorText = (id: string, key: string) => (
    <p id={id} className="font-semibold text-danger">
      <span aria-hidden="true">⚠ </span>
      {t(key)}
    </p>
  );

  return (
    <main className="flex flex-col gap-6 py-4">
      <h1 className="text-[1.4rem] font-bold">{mode === "edit" ? t("form.titleEdit") : t("form.titleAdd")}</h1>

      {message && (
        <p role="alert" className="rounded-lg border-2 border-line bg-card p-3 font-semibold">
          <span aria-hidden="true">⚠ </span>
          {message}
        </p>
      )}

      {/* Errors are announced as they appear. */}
      <div aria-live="polite" className="sr-only">
        {submitted &&
          (Object.keys(errors) as (keyof typeof errors)[])
            .filter((k) => errors[k])
            .map((k) =>
              t(
                {
                  name: "form.errors.name",
                  category: "form.errors.category",
                  date: "form.errors.datePast",
                  time: "form.errors.timePast",
                }[k],
              ),
            )
            .join(" ")}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.name} className="text-[1.2rem] font-bold">
          {t("form.name")}
        </label>
        <input
          id={ids.name}
          aria-label={t("form.name")}
          type="text"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={show("name")}
          aria-describedby={show("name") ? ids.nameErr : undefined}
          className={inputClass}
        />
        {show("name") && errorText(ids.nameErr, "form.errors.name")}
      </div>

      <div className="flex flex-col gap-2">
        <p id={ids.cat} className="text-[1.2rem] font-bold">
          {t("form.category")}
        </p>
        <div role="group" aria-labelledby={ids.cat} className="flex flex-wrap gap-3">
          {categories.map((c) => {
            const label = categoryLabel(c, t);
            const on = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                aria-label={label}
                onClick={() => setCategoryId(c.id)}
                className="btn"
              >
                {on && <span aria-hidden="true">✓</span>}
                {label}
              </button>
            );
          })}
          {!addingCat && (
            <button
              type="button"
              onClick={() => setAddingCat(true)}
              aria-label={t("form.addCategory")}
              className="btn border-dashed"
            >
              {t("form.addCategory")}
            </button>
          )}
        </div>
        {addingCat && (
          <div className="flex flex-col gap-3 rounded-lg border-2 border-line bg-card p-3">
            <label htmlFor={ids.newCat} className="font-bold">
              {t("form.newCategoryName")}
            </label>
            <input
              id={ids.newCat}
              aria-label={t("form.newCategoryName")}
              type="text"
              value={newCat}
              maxLength={30}
              autoFocus
              onChange={(e) => setNewCat(e.target.value)}
              aria-invalid={newCatError}
              aria-describedby={newCatError ? ids.newCatErr : undefined}
              className={inputClass}
            />
            {newCatError && (
              <p id={ids.newCatErr} role="alert" className="font-semibold text-danger">
                <span aria-hidden="true">⚠ </span>
                {t("form.errors.categoryName")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={addCategory} aria-label={t("form.addCategorySave")} className="btn btn-primary w-full">
                {t("form.addCategorySave")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCat(false);
                  setNewCat("");
                  setNewCatError(false);
                }}
                aria-label={t("form.addCategoryCancel")}
                className="btn w-full"
              >
                {t("form.addCategoryCancel")}
              </button>
            </div>
          </div>
        )}
        {show("category") && errorText(ids.catErr, "form.errors.category")}
      </div>

      <div className="flex flex-col gap-2">
        <p id={ids.date} className="text-[1.2rem] font-bold">
          {t("form.date")}
        </p>
        <DatePicker
          value={date}
          onChange={setDate}
          labelledBy={ids.date}
          describedBy={show("date") ? ids.dateErr : undefined}
        />
        {show("date") && errorText(ids.dateErr, "form.errors.datePast")}
      </div>

      <div className="flex flex-col gap-2">
        <p id={ids.time} className="text-[1.2rem] font-bold">
          {t("form.time")}
        </p>
        <button
          type="button"
          aria-pressed={allDay}
          aria-label={labelWith(t("form.allDay"), allDay ? t("settings.on") : t("settings.off"))}
          onClick={() => setAllDay(!allDay)}
          className="btn w-full flex-wrap justify-between gap-x-3 gap-y-0 text-left"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block w-6 text-center">
              {allDay ? "✓" : ""}
            </span>
            {t("form.allDay")}
          </span>{" "}
          <span>{allDay ? t("settings.on") : t("settings.off")}</span>
        </button>
        {!allDay && (
          <TimePicker
            value={time}
            onChange={setTime}
            labelledBy={ids.time}
            describedBy={show("time") ? ids.timeErr : undefined}
          />
        )}
        {show("time") && errorText(ids.timeErr, "form.errors.timePast")}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.place} className="text-[1.2rem] font-bold">
          {t("form.place")}
        </label>
        <input
          id={ids.place}
          aria-label={t("form.place")}
          type="text"
          value={place}
          maxLength={100}
          onChange={(e) => setPlace(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" onClick={save} aria-label={t("form.save")} className="btn btn-primary w-full">
          {t("form.save")}
        </button>
        <button type="button" onClick={onCancel} aria-label={t("form.cancel")} className="btn w-full">
          {t("form.cancel")}
        </button>
        {mode === "edit" && onDelete && (
          <button
            ref={deleteBtnRef}
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={t("form.delete")}
            className="btn btn-danger w-full"
          >
            {t("form.delete")}
          </button>
        )}
      </div>

      {confirmDelete && onDelete && (
        <ConfirmDeleteDialog
          onYes={onDelete}
          onNo={() => {
            setConfirmDelete(false);
            deleteBtnRef.current?.focus();
          }}
        />
      )}
    </main>
  );
}
