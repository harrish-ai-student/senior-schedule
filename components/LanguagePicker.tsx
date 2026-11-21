"use client";

import { labelWith, LANGS, translate, useI18n, type Lang } from "@/lib/i18n";

type Props = {
  current: Lang | null;
  onPick: (lang: Lang) => void;
  onBack?: () => void;
};

export default function LanguagePicker({ current, onPick, onBack }: Props) {
  const { t } = useI18n();
  return (
    <main className="flex flex-col gap-6 py-6">
      {/* Heading shown in all four languages so anyone can find their own. */}
      <h1 className="text-[1.4rem] font-bold">
        {LANGS.map((code) => (
          <span key={code} lang={code} className="block">
            {translate(code, "language.choose")}
          </span>
        ))}
      </h1>
      <div className="flex flex-col gap-4">
        {LANGS.map((code) => {
          const name = translate(code, "language.name");
          return (
            <button
              key={code}
              type="button"
              lang={code}
              aria-label={name}
              aria-pressed={current === code}
              onClick={() => onPick(code)}
              className="btn w-full min-h-[80px] text-[1.4rem]"
            >
              {current === code && <span aria-hidden="true">✓</span>}
              {name}
            </button>
          );
        })}
      </div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={labelWith(t("common.back"), t("common.backAria"))}
          className="btn w-full"
        >
          {t("common.back")}
        </button>
      )}
    </main>
  );
}
