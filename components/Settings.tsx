"use client";

import { useEffect, useState } from "react";
import { LANGS, labelWith, translate, useI18n } from "@/lib/i18n";
import { LEAD_TIMES, TEXT_SIZES, type Settings as SettingsType } from "@/lib/storage";

type Props = {
  settings: SettingsType;
  onChange: (next: SettingsType) => void;
  onDone: () => void;
};

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className="inline-block w-6 text-center">
      {on ? "✓" : ""}
    </span>
  );
}

type Permission = "unsupported" | NotificationPermission;

export default function Settings({ settings, onChange, onDone }: Props) {
  const { t } = useI18n();
  const [permission, setPermission] = useState<Permission>("default");

  // Read the current state only; permission is requested only when the button is pressed.
  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const askPermission = async () => {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission(Notification.permission);
    }
  };

  const toggleLead = (lead: string) => {
    const has = settings.leadTimes.includes(lead);
    const leadTimes = has
      ? settings.leadTimes.filter((l) => l !== lead)
      : [...settings.leadTimes, lead];
    onChange({ ...settings, leadTimes });
  };

  return (
    <main className="flex flex-col gap-8 py-4">
      <h1 className="text-[1.4rem] font-bold">{t("settings.title")}</h1>

      <section aria-labelledby="set-lang" className="flex flex-col gap-3">
        <h2 id="set-lang" className="text-[1.4rem] font-bold">
          {t("settings.language")}
        </h2>
        {LANGS.map((code) => {
          const name = translate(code, "language.name");
          const on = settings.lang === code;
          return (
            <button
              key={code}
              type="button"
              lang={code}
              aria-label={name}
              aria-pressed={on}
              onClick={() => onChange({ ...settings, lang: code })}
              className="btn w-full justify-start"
            >
              <Check on={on} />
              {name}
            </button>
          );
        })}
      </section>

      <section aria-labelledby="set-size" className="flex flex-col gap-3">
        <h2 id="set-size" className="text-[1.4rem] font-bold">
          {t("settings.textSize")}
        </h2>
        {TEXT_SIZES.map((size) => {
          const on = settings.textSize === size;
          return (
            <button
              key={size}
              type="button"
              aria-label={t(`textSize.${size}`)}
              aria-pressed={on}
              onClick={() => onChange({ ...settings, textSize: size })}
              className="btn w-full justify-start"
            >
              <Check on={on} />
              {t(`textSize.${size}`)}
            </button>
          );
        })}
      </section>

      <section aria-labelledby="set-lead" className="flex flex-col gap-3">
        <h2 id="set-lead" className="text-[1.4rem] font-bold">
          {t("settings.reminders")}
        </h2>
        <p>{t("settings.remindersHint")}</p>
        {LEAD_TIMES.map((lead) => {
          const on = settings.leadTimes.includes(lead);
          return (
            <button
              key={lead}
              type="button"
              aria-label={labelWith(t(`lead.${lead}`), on ? t("settings.selected") : t("settings.notSelected"))}
              aria-pressed={on}
              onClick={() => toggleLead(lead)}
              className="btn w-full flex-wrap justify-between gap-x-3 gap-y-0 text-left"
            >
              <span className="flex items-center gap-2">
                <Check on={on} />
                {t(`lead.${lead}`)}
              </span>{" "}
              <span>{on ? t("settings.selected") : t("settings.notSelected")}</span>
            </button>
          );
        })}
        {settings.leadTimes.length === 0 && (
          <p role="alert" className="font-semibold text-danger">
            {t("settings.remindersNone")}
          </p>
        )}
      </section>

      <section aria-labelledby="set-sound" className="flex flex-col gap-3">
        <h2 id="set-sound" className="text-[1.4rem] font-bold">
          {t("settings.sound")}
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {[true, false].map((value) => {
            const label = value ? t("settings.on") : t("settings.off");
            return (
              <button
                key={label}
                type="button"
                aria-label={`${t("settings.sound")}: ${label}`}
                aria-pressed={settings.sound === value}
                onClick={() => onChange({ ...settings, sound: value })}
                className="btn w-full"
              >
                <Check on={settings.sound === value} />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="set-notify" className="flex flex-col gap-3">
        <h2 id="set-notify" className="text-[1.4rem] font-bold">
          {t("notify.title")}
        </h2>
        <p>{t("notify.hint")}</p>
        <div aria-live="polite">
          {permission === "granted" && (
            <p className="font-semibold">
              <span aria-hidden="true">✓ </span>
              {t("notify.granted")}
            </p>
          )}
          {permission === "denied" && (
            <p className="font-semibold text-danger">
              <span aria-hidden="true">⚠ </span>
              {t("notify.denied")}
            </p>
          )}
          {permission === "unsupported" && (
            <p className="font-semibold">
              <span aria-hidden="true">⚠ </span>
              {t("notify.unsupported")}
            </p>
          )}
        </div>
        {permission === "default" && (
          <button type="button" onClick={askPermission} aria-label={t("notify.allow")} className="btn w-full">
            <span aria-hidden="true">🔔</span>
            {t("notify.allow")}
          </button>
        )}
      </section>

      <button
        type="button"
        onClick={onDone}
        aria-label={labelWith(t("settings.done"), t("settings.doneAria"))}
        className="btn btn-primary w-full"
      >
        {t("settings.done")}
      </button>
    </main>
  );
}
