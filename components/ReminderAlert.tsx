"use client";

import { useEffect, useId, useRef } from "react";
import { SPEECH_LOCALES, useI18n, type Lang } from "@/lib/i18n";

type Props = {
  title: string;
  when: string;
  sound: boolean;
  onOk: () => void;
  onSnooze: () => void;
};

const CHIME_EVERY_MS = 3000;

/** A soft two-note chime made with Web Audio, so no sound files are needed. */
function playChime(ctx: AudioContext) {
  const notes: [number, number][] = [
    [660, 0],
    [880, 0.35],
  ];
  for (const [freq, offset] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + offset;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 1);
  }
}

/** Finds a voice for the language; returns null when the device has none (common for Tamil). */
function findVoice(lang: Lang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const norm = (s: string) => s.replace("_", "-").toLowerCase();
  const full = SPEECH_LOCALES[lang].toLowerCase();
  return (
    voices.find((v) => norm(v.lang) === full) ??
    voices.find((v) => norm(v.lang).startsWith(`${lang}-`) || norm(v.lang) === lang) ??
    null
  );
}

function speak(text: string, lang: Lang): () => void {
  if (!("speechSynthesis" in window)) return () => {};
  const synth = window.speechSynthesis;
  let done = false;
  const trySpeak = () => {
    if (done) return;
    const voice = findVoice(lang);
    if (!voice) return; // No voice for this language: rely on sound and text, without an error.
    done = true;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    synth.cancel();
    synth.speak(u);
  };
  // Voices can load after the page; try again once they arrive.
  if (synth.getVoices().length > 0) trySpeak();
  else synth.addEventListener("voiceschanged", trySpeak, { once: true });
  return () => {
    done = true;
    synth.removeEventListener("voiceschanged", trySpeak);
    synth.cancel();
  };
}

export default function ReminderAlert({ title, when, sound, onOk, onSnooze }: Props) {
  const { lang, t } = useI18n();
  const okRef = useRef<HTMLButtonElement>(null);
  const snoozeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const whenId = useId();

  useEffect(() => {
    okRef.current?.focus();
  }, [title, when]);

  // Gentle repeating sound until the alert is closed.
  useEffect(() => {
    if (!sound) return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const ring = () => {
      ctx.resume().then(() => playChime(ctx)).catch(() => {});
    };
    ring();
    const id = window.setInterval(ring, CHIME_EVERY_MS);
    return () => {
      window.clearInterval(id);
      ctx.close().catch(() => {});
    };
  }, [sound, title, when]);

  // Speak the event once when the alert appears.
  useEffect(() => speak(`${title}. ${when}`, lang), [title, when, lang]);

  // Keep keyboard focus on the two buttons.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === okRef.current ? snoozeRef : okRef).current?.focus();
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={whenId}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 overflow-y-auto bg-page"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-center gap-6 px-4 py-8">
        <p className="text-[1.4rem] font-bold">
          <span aria-hidden="true">🔔 </span>
          {t("reminder.label")}
        </p>
        <h2 id={titleId} className="break-words text-[2.4rem] font-bold leading-[1.6]">
          {title}
        </h2>
        <p id={whenId} className="text-[1.6rem] font-semibold">
          {when}
        </p>
        <button ref={okRef} type="button" onClick={onOk} aria-label={t("reminder.ok")} className="btn btn-primary w-full min-h-[80px] text-[1.3rem]">
          {t("reminder.ok")}
        </button>
        <button ref={snoozeRef} type="button" onClick={onSnooze} aria-label={t("reminder.snooze")} className="btn w-full min-h-[72px] text-[1.2rem]">
          {t("reminder.snooze")}
        </button>
      </div>
    </div>
  );
}
