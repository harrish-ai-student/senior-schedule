"use client";

import { useId, useState } from "react";
import { getTimeZone, nowISO } from "@/lib/dates";
import { labelWith, useI18n, type Lang } from "@/lib/i18n";
import { MAX_PARSE_TEXT, ParseResultSchema, type ParseResult } from "@/lib/schema";

const AI_TIMEOUT_MS = 10_000;

/**
 * Sends text to /api/parse. Resolves to null on any failure (network, timeout,
 * missing key, unreadable result) so callers can fall back to the Manual form.
 */
export async function requestParse(text: string, lang: Lang): Promise<ParseResult | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang, nowISO: nowISO(), timezone: getTimeZone() }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const parsed = ParseResultSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

type Props = {
  onResult: (result: ParseResult, text: string) => void;
  onFailure: (text: string) => void;
  onBack: () => void;
};

export default function TypeScreen({ onResult, onFailure, onBack }: Props) {
  const { lang, t } = useI18n();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [emptyError, setEmptyError] = useState(false);
  const fieldId = useId();
  const errorId = useId();
  const statusId = useId();

  const next = async () => {
    const value = text.trim();
    if (!value) {
      setEmptyError(true);
      return;
    }
    setLoading(true);
    const result = await requestParse(value, lang);
    setLoading(false);
    if (result) onResult(result, value);
    else onFailure(value);
  };

  return (
    <main className="flex flex-col gap-5 py-4">
      <h1 className="text-[1.6rem] font-bold">{t("type.title")}</h1>
      <label htmlFor={fieldId} className="text-[1.2rem] font-bold">
        {t("type.label")}
      </label>
      <textarea
        id={fieldId}
        aria-label={t("type.label")}
        value={text}
        rows={5}
        maxLength={MAX_PARSE_TEXT}
        readOnly={loading}
        placeholder={t("type.placeholder")}
        onChange={(e) => {
          setText(e.target.value);
          setEmptyError(false);
        }}
        aria-invalid={emptyError}
        aria-describedby={emptyError ? errorId : undefined}
        className="w-full rounded-lg border-2 border-line bg-card p-3 text-[1.2rem] text-ink placeholder:text-muted"
      />
      <div aria-live="polite">
        {emptyError && (
          <p id={errorId} className="font-semibold text-danger">
            <span aria-hidden="true">⚠ </span>
            {t("type.empty")}
          </p>
        )}
        {loading && (
          <p id={statusId} className="font-semibold">
            {t("type.reading")}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={next}
        disabled={loading}
        aria-busy={loading}
        aria-label={loading ? t("type.reading") : t("type.next")}
        className="btn btn-primary w-full min-h-[72px] text-[1.2rem]"
      >
        {loading ? t("type.reading") : t("type.next")}
      </button>
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        aria-label={labelWith(t("common.back"), t("common.backAria"))}
        className="btn w-full"
      >
        <span aria-hidden="true">◀</span>
        {t("common.back")}
      </button>
    </main>
  );
}
