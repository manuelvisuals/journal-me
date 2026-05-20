"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDurationMmSs } from "@/lib/format";

type Props = {
  onStop: (transcript: string, durationSeconds: number) => void;
  onCancel: () => void;
};

type RecState = "idle" | "recording" | "paused";

export function RecordingOverlay({ onStop, onCancel }: Props) {
  const [transcript, setTranscript] = useState<string>("");
  const [interim, setInterim] = useState<string>("");
  const [seconds, setSeconds] = useState<number>(0);
  // Overlay only mounts after the user clicks the mic, so the initial state
  // is always "recording" — no need to flip it synchronously in an effect.
  const [state, setState] = useState<RecState>("recording");
  // Lazy initializer: run support check on first render (client-only, since
  // this component never mounts on the server — it's behind a user click).
  const [supportError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    return Ctor
      ? null
      : "Il microfono non e disponibile su questo browser. Prova con Safari o Chrome.";
  });

  // Refs that survive re-renders without retriggering effects.
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(
    null,
  );
  const shouldRunRef = useRef<boolean>(false);
  const finalRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Build the recognition instance once on mount.
  useEffect(() => {
    if (supportError) return;
    const rec = createRecognition();
    if (!rec) return;
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current = (finalRef.current + " " + text).trim();
          setTranscript(finalRef.current);
        } else {
          interimText += text;
        }
      }
      setInterim(interimText);
    };

    rec.onend = () => {
      // iOS Safari auto-stops after ~60s. Restart if we still want to record.
      if (shouldRunRef.current) {
        try {
          rec.start();
        } catch {
          // already started — ignore
        }
      }
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      // Other errors: stop gracefully.
      shouldRunRef.current = false;
      setState("idle");
      stopTimer();
    };

    recognitionRef.current = rec;
    // Auto-start as soon as we mount. Initial state is already "recording".
    shouldRunRef.current = true;
    try {
      rec.start();
    } catch {
      // start() can throw if already running — that's fine.
    }
    startTimer();

    return () => {
      shouldRunRef.current = false;
      try {
        rec.abort();
      } catch {
        // ignore
      }
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = () => {
    shouldRunRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    stopTimer();
    setState("idle");
    const final = finalRef.current.trim() || interim.trim();
    onStop(final, seconds);
  };

  const handleCancel = () => {
    shouldRunRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    stopTimer();
    onCancel();
  };

  const togglePause = () => {
    if (state === "recording") {
      shouldRunRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      stopTimer();
      setState("paused");
      return;
    }
    if (state === "paused" && recognitionRef.current) {
      shouldRunRef.current = true;
      try {
        recognitionRef.current.start();
      } catch {
        // already running
      }
      setState("recording");
      startTimer();
    }
  };

  // Split transcript into "older" (everything but last sentence/chunk) and "recent" (last chunk).
  const { older, recent } = splitTranscript(transcript);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--color-bg-phone)" }}
    >
      <div
        className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
        style={{ padding: "24px 24px 0" }}
      >
        {/* Live indicator + timer */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div className="flex items-center" style={{ gap: 7 }}>
            <span
              className="inline-block"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-danger)",
                boxShadow: "0 0 10px rgba(248,113,113,0.7)",
                opacity: state === "recording" ? 1 : 0.45,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 650,
                color: "var(--color-danger)",
                letterSpacing: "0.20em",
                textTransform: "uppercase",
              }}
            >
              {state === "paused" ? "pausa" : "live"}
            </span>
          </div>
          <span
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
              fontSize: 18,
              fontWeight: 500,
              color: "var(--color-ink)",
              letterSpacing: "0.06em",
            }}
          >
            {formatDurationMmSs(seconds)}
          </span>
        </div>

        {supportError ? (
          <div
            style={{
              padding: 16,
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              background: "var(--color-surface)",
              color: "var(--color-ink-muted)",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            {supportError}
          </div>
        ) : (
          <>
            {/* Transcript */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: "12px 4px", fontSize: 17, lineHeight: 1.6 }}
            >
              {older && (
                <p style={{ color: "var(--color-ink-faint)", marginBottom: 10 }}>
                  {older}
                </p>
              )}
              {recent && (
                <p style={{ color: "var(--color-ink-muted)", marginBottom: 10 }}>
                  {recent}
                </p>
              )}
              <p style={{ color: "var(--color-ink)", marginBottom: 10 }}>
                {interim}
                {state === "recording" && <span className="live-caret" />}
              </p>
              {!transcript && !interim && state === "recording" && (
                <p style={{ color: "var(--color-ink-faint)", fontStyle: "italic" }}>
                  Parla pure...
                </p>
              )}
            </div>

            {/* Waveform (CSS-animated bars — visual only) */}
            <Waveform active={state === "recording"} />
          </>
        )}

        {/* Controls */}
        <div
          className="flex items-center justify-center"
          style={{ gap: 28, padding: "16px 0 10px" }}
        >
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Annulla registrazione"
            className="rec-ctl"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleStop}
            aria-label="Termina e salva"
            className="rec-ctl rec-ctl-stop"
          >
            <span
              style={{
                width: 24,
                height: 24,
                background: "white",
                borderRadius: 5,
                display: "block",
              }}
            />
          </button>

          <button
            type="button"
            onClick={togglePause}
            aria-label={state === "paused" ? "Riprendi" : "Pausa"}
            className="rec-ctl"
          >
            {state === "paused" ? (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </button>
        </div>

        <p
          className="text-center"
          style={{
            fontSize: 11,
            color: "var(--color-ink-faint)",
            letterSpacing: "0.04em",
            padding: "10px 0 22px",
          }}
        >
          audio sul telefono . solo il testo va al cloud
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

function createRecognition() {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

function splitTranscript(text: string): { older: string; recent: string } {
  const trimmed = text.trim();
  if (!trimmed) return { older: "", recent: "" };
  // Split on sentence boundary, last sentence = "recent".
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  if (parts.length <= 1) return { older: "", recent: trimmed };
  return {
    older: parts.slice(0, -1).join(" "),
    recent: parts[parts.length - 1] ?? "",
  };
}

function Waveform({ active }: { active: boolean }) {
  const bars = [
    { h: 6, delay: 0 },
    { h: 14, delay: 120 },
    { h: 22, delay: 60 },
    { h: 10, delay: 220 },
    { h: 28, delay: 90 },
    { h: 16, delay: 160 },
    { h: 24, delay: 30 },
    { h: 12, delay: 200 },
    { h: 30, delay: 140 },
    { h: 18, delay: 80 },
    { h: 22, delay: 240 },
    { h: 10, delay: 110 },
    { h: 16, delay: 170 },
  ];
  return (
    <div
      className="flex items-center justify-center"
      style={{ gap: 3, height: 36, margin: "18px 0 8px" }}
    >
      {bars.map((b, i) => (
        <span
          key={i}
          style={{
            width: 2,
            height: b.h,
            borderRadius: 2,
            background: "var(--color-danger)",
            opacity: active ? 1 : 0.25,
            animation: active
              ? `jm-wave 0.9s ease-in-out ${b.delay}ms infinite alternate`
              : "none",
            display: "inline-block",
          }}
        />
      ))}
      <style>{`
        @keyframes jm-wave {
          0% { transform: scaleY(0.45); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
