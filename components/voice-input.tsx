"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@/components/icons";

// Not in TypeScript's DOM lib; Chrome and Safari ship it as webkitSpeechRecognition.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor() {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

type Support = "ok" | "insecure" | "unsupported";
const noSubscribe = () => () => {};
const getSupport = (): Support => (!window.isSecureContext ? "insecure" : recognitionCtor() ? "ok" : "unsupported");

const LANGS = [
  { code: "en-IN", label: "English" },
  { code: "ne-NP", label: "नेपाली" },
];

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser settings.",
  "no-speech": "Didn't hear anything. Tap the mic and speak.",
  "audio-capture": "No microphone found.",
  network: "Voice service unreachable. Check the internet.",
  "language-not-supported": "This browser can't recognise that language. Try English.",
};

/** Speech → text in the browser. Each tap captures one phrase and appends it to the text. */
export function VoiceInput({ text, setText }: { text: string; setText: Dispatch<SetStateAction<string>> }) {
  const support = useSyncExternalStore(noSubscribe, getSupport, () => "ok" as Support);
  const [lang, setLang] = useState(LANGS[0].code);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => () => recognition.current?.abort(), []);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    // One phrase per tap: continuous mode repeats results on Android Chrome.
    r.continuous = false;
    r.onresult = (e) => {
      let final = "";
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else partial += result[0].transcript;
      }
      setHeard(partial);
      if (final.trim()) setText((t) => (t.trim() ? `${t.trim()}, ${final.trim()}` : final.trim()));
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? "Voice input stopped. Try again.");
    };
    r.onend = () => {
      setListening(false);
      setHeard("");
      recognition.current = null;
    };
    recognition.current = r;
    setError(null);
    setListening(true);
    r.start();
  }

  if (support !== "ok") {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        {support === "insecure"
          ? "Voice needs the secure (https://) address of this app. On shop Wi-Fi, use the Text tab and tap the 🎤 on your phone keyboard instead."
          : "This browser can't do voice input. Use Chrome or Safari, or the Text tab with your keyboard's 🎤."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5">
        <div className="flex gap-1 rounded-full bg-stone-100 p-1" role="radiogroup" aria-label="Language you speak">
          {LANGS.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={lang === l.code}
              disabled={listening}
              onClick={() => setLang(l.code)}
              className={`rounded-full px-3 py-1 text-sm ${lang === l.code ? "bg-white font-medium shadow-sm" : "text-stone-500"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => (listening ? recognition.current?.stop() : start())}
          aria-label={listening ? "Stop listening" : "Start speaking"}
          className={`flex size-20 items-center justify-center rounded-full text-white ${
            listening ? "animate-pulse bg-red-600" : "bg-emerald-700"
          }`}
        >
          <Icon name={listening ? "stop" : "mic"} className="size-8" />
        </button>
        <p className="min-h-5 text-center text-sm text-stone-500" aria-live="polite">
          {listening ? heard || "Listening…" : "Tap and say what you sold or what arrived"}
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What you say appears here. You can fix it before reading."
        aria-label="What you said"
        className="w-full rounded-2xl border border-stone-300 bg-white p-4 text-base"
      />
    </div>
  );
}
