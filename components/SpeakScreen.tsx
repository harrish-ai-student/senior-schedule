"use client";

import { useEffect, useRef, useState } from "react";
import { requestParse } from "@/components/TypeScreen";
import { SPEECH_LOCALES, useI18n } from "@/lib/i18n";
import type { ParseResult } from "@/lib/schema";

/* Minimal typings for the Web Speech API, which TypeScript's DOM library does not fully cover. */
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Status = "ready" | "listening" | "processing" | "unsupported" | "denied";
type Notice = "noSpeech" | "failed" | null;

type Props = {
  onResult: (result: ParseResult, text: string) => void;
  onFailure: (text: string) => void;
  onUseType: () => void;
  onCancel: () => void;
};

function MicIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
    </svg>
  );
}

export default function SpeakScreen({ onResult, onFailure, onUseType, onCancel }: Props) {
  const { lang, t } = useI18n();
  const [status, setStatus] = useState<Status>("ready");
  const [notice, setNotice] = useState<Notice>(null);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const textRef = useRef("");
  const errorRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  // Feature and permission checks run after mount so server and client render the same.
  useEffect(() => {
    cancelledRef.current = false;
    if (!getRecognitionCtor()) {
      setStatus("unsupported");
      return;
    }
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => {
        if (p.state === "denied" && !cancelledRef.current) setStatus("denied");
      })
      .catch(() => {
        // Not every browser can report microphone permission; starting will tell us.
      });
    return () => {
      cancelledRef.current = true;
      recRef.current?.abort();
    };
  }, []);

  const finish = async () => {
    const error = errorRef.current;
    recRef.current = null;
    if (cancelledRef.current) return;
    if (error === "not-allowed" || error === "service-not-allowed") {
      setStatus("denied");
      return;
    }
    const text = textRef.current.trim();
    if (!text) {
      setStatus("ready");
      setNotice(error && error !== "no-speech" ? "failed" : "noSpeech");
      return;
    }
    // Stopped talking: send what was heard straight away.
    setStatus("processing");
    const result = await requestParse(text, lang);
    if (cancelledRef.current) return;
    if (result) onResult(result, text);
    else onFailure(text);
  };

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.lang = SPEECH_LOCALES[lang];
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    textRef.current = "";
    errorRef.current = null;
    setTranscript("");
    setNotice(null);

    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      textRef.current = text;
      setTranscript(text);
    };
    rec.onerror = (e) => {
      errorRef.current = e.error;
    };
    rec.onend = () => {
      void finish();
    };

    recRef.current = rec;
    try {
      rec.start();
      setStatus("listening");
    } catch {
      recRef.current = null;
      setNotice("failed");
    }
  };

  const onMic = () => {
    if (status === "listening") recRef.current?.stop();
    else if (status === "ready") start();
  };

  const cancel = () => {
    cancelledRef.current = true;
    recRef.current?.abort();
    onCancel();
  };

  const cancelButton = (
    <button type="button" onClick={cancel} aria-label={t("speak.cancel")} className="btn w-full">
      {t("speak.cancel")}
    </button>
  );

  if (status === "unsupported" || status === "denied") {
    return (
      <main className="flex flex-col gap-5 py-4">
        <h1 className="text-[1.6rem] font-bold">{t("speak.title")}</h1>
        <p role="alert" className="rounded-lg border-2 border-line bg-card p-4 text-[1.2rem] font-semibold">
          <span aria-hidden="true">⚠ </span>
          {status === "unsupported" ? t("speak.unsupported") : t("speak.denied")}
        </p>
        <button type="button" onClick={onUseType} aria-label={t("speak.useType")} className="btn btn-primary w-full min-h-[72px]">
          {t("speak.useType")}
        </button>
        {cancelButton}
      </main>
    );
  }

  const listening = status === "listening";
  const processing = status === "processing";
  const micLabel = listening ? t("speak.micStop") : processing ? t("speak.processing") : t("speak.micStart");

  return (
    <main className="flex flex-col items-center gap-5 py-4">
      <h1 className="w-full text-[1.6rem] font-bold">{t("speak.title")}</h1>

      <div aria-live="polite" className="w-full text-center">
        {listening ? (
          <p className="text-[1.6rem] font-bold">
            <span aria-hidden="true">● </span>
            {t("speak.listening")}
          </p>
        ) : processing ? (
          <p className="text-[1.4rem] font-bold">{t("speak.processing")}</p>
        ) : (
          <p className="text-[1.2rem]">{t("speak.ready")}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onMic}
        disabled={processing}
        aria-label={micLabel}
        aria-pressed={listening}
        className={`flex h-[13rem] w-[13rem] flex-col items-center justify-center gap-2 rounded-full border-4 p-4 text-center font-bold text-white ${
          listening
            ? "listening-ring border-ink bg-danger"
            : "border-accent bg-accent disabled:border-dashed disabled:border-ink"
        }`}
      >
        <MicIcon className="h-20 w-20" />
        <span>{micLabel}</span>
      </button>

      <div aria-live="polite" className="w-full">
        {notice && (
          <p className="rounded-lg border-2 border-line bg-card p-3 font-semibold text-danger">
            <span aria-hidden="true">⚠ </span>
            {notice === "noSpeech" ? t("speak.noSpeech") : t("speak.failed")}
          </p>
        )}
      </div>

      <section aria-live="polite" className="w-full rounded-lg border-2 border-line bg-card p-4">
        {transcript ? (
          <>
            <p className="font-semibold">{t("speak.heard")}</p>
            <p className="break-words text-[1.5rem] font-bold">{transcript}</p>
          </>
        ) : (
          <p>{t("speak.example", { text: t("type.placeholder") })}</p>
        )}
      </section>

      {cancelButton}
    </main>
  );
}
