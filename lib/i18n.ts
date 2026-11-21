import { createContext, useContext } from "react";
import en from "@/locales/en.json";
import ms from "@/locales/ms.json";
import zh from "@/locales/zh.json";
import ta from "@/locales/ta.json";
import type { Category } from "./schema";

export type Lang = "en" | "ms" | "zh" | "ta";
export const LANGS: Lang[] = ["en", "ms", "zh", "ta"];

/** Locales for Intl.DateTimeFormat. */
export const DATE_LOCALES: Record<Lang, string> = {
  en: "en-MY",
  ms: "ms-MY",
  zh: "zh-CN",
  ta: "ta-IN",
};

/** Language tags for SpeechRecognition and speechSynthesis. */
export const SPEECH_LOCALES: Record<Lang, string> = {
  en: "en-MY",
  ms: "ms-MY",
  zh: "zh-CN",
  ta: "ta-IN",
};

type Dict = { [key: string]: string | Dict };
const DICTS: Record<Lang, Dict> = { en, ms, zh, ta } as Record<Lang, Dict>;

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as string[]).includes(value);
}

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export type Vars = Record<string, string | number>;

/** Look up a dotted key; falls back to English, then to the key itself. */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  const raw = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type TFunc = (key: string, vars?: Vars) => string;

/** Accessible name that starts with the visible text, then adds detail (WCAG 2.5.3). */
export function labelWith(visible: string, detail: string): string {
  return `${visible}. ${detail}`;
}

export type I18nValue = { lang: Lang; t: TFunc };

export const I18nContext = createContext<I18nValue>({
  lang: "en",
  t: (key, vars) => translate("en", key, vars),
});

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Built-in categories are translated; custom ones show the user's own label. */
export function categoryLabel(category: Category | undefined, t: TFunc): string {
  if (!category) return "";
  if (category.key) return t(`category.${category.key}`);
  return category.label ?? "";
}
