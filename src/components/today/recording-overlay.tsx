"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  compactDayDate,
  formatDurationMmSs,
  parseISODate,
  relativeDayLabel,
  todayISO,
} from "@/lib/format";
import { DatePickerPopover } from "@/components/today/date-picker-popover";
import { loadGlossary } from "@/lib/data/glossary";
import type { DataMode } from "@/lib/data/entries";

// useSyncExternalStore needs a stable subscribe function; we never notify
// because the snapshot is constant after hydration.
function subscribeNoop(): () => void {
  return () => {};
}

// Module-level cache of the mic MediaStream so the browser doesn't re-prompt
// the user for permission every single time they open the recording overlay
// within the same page session.
let cachedMicStream: MediaStream | null = null;

async function acquireMicStream(): Promise<MediaStream> {
  if (
    cachedMicStream &&
    cachedMicStream.active &&
    cachedMicStream
      .getAudioTracks()
      .some((t) => t.readyState === "live" && t.enabled !== false)
  ) {
    // Re-enable all tracks (in case pause/cleanup disabled them).
    cachedMicStream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    return cachedMicStream;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  cachedMicStream = stream;
  return stream;
}

type Props = {
  /** Default date for segments without explicit temporal markers (YYYY-MM-DD). */
  defaultDate?: string;
  /** Demo or auth — needed to fetch the glossary client-side. */
  mode?: DataMode;
  onStop: (
    transcript: string,
    durationSeconds: number,
    targetDate: string,
  ) => void;
  onCancel: () => void;
};

type RecState = "connecting" | "recording" | "paused" | "error";

/**
 * Records the user's voice using OpenAI Realtime API (transcription-only)
 * over WebRTC. The mic audio is streamed to OpenAI; transcript deltas and
 * completions arrive on a data channel.
 *
 * The `/api/realtime/session` endpoint relays the SDP handshake so the
 * OPENAI_API_KEY never reaches the browser.
 */
export function RecordingOverlay({ defaultDate, mode, onStop, onCancel }: Props) {
  const [transcript, setTranscript] = useState<string>("");
  const [interim, setInterim] = useState<string>("");
  const [seconds, setSeconds] = useState<number>(0);
  const [state, setState] = useState<RecState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string>(
    defaultDate ?? todayISO(),
  );
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  const [silenceWarning, setSilenceWarning] = useState<boolean>(false);
  // Mount flag for the document.body portal — avoids SSR mismatch and
  // ensures the overlay escapes any ancestor stacking context (e.g. the
  // fixed-positioned quick-capture bar on /remember which would otherwise
  // trap the overlay below the bottom tab bar). useSyncExternalStore avoids
  // the React 19 lint rule against setState-in-useEffect.
  const portalReady = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  // Refs to objects that must survive across renders without triggering effects.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const finalRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanedUpRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptAtRef = useRef<number>(0);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Setup the realtime connection once on mount.
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        // 1. Mic permission (re-uses cached stream when possible)
        const stream = await acquireMicStream();
        if (cancelled) {
          // Don't stop the cached stream — we want to re-use it next time.
          return;
        }
        localStreamRef.current = stream;
        audioTrackRef.current = stream.getAudioTracks()[0] ?? null;

        // 2. Peer connection + data channel
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // Add mic as a transceiver so SDP includes audio
        if (audioTrackRef.current) {
          pc.addTrack(audioTrackRef.current, stream);
        }

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onmessage = (e) => {
          handleEvent(e.data);
        };
        dc.onopen = () => {
          // Data channel is ready — we're effectively live.
        };

        pc.oniceconnectionstatechange = () => {
          if (
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "disconnected"
          ) {
            if (!cleanedUpRef.current) {
              setErrorMessage(
                "Connessione persa con il servizio di trascrizione.",
              );
              setState("error");
            }
          }
        };

        // 3. SDP offer + handshake
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        if (cancelled) return;

        // Best-effort: include the glossary as a header so the
        // transcription model treats the user's proper names as
        // in-vocabulary. Works for demo (localStorage) and auth.
        const headers: Record<string, string> = {
          "Content-Type": "application/sdp",
        };
        try {
          const terms = await loadGlossary(mode ?? "auth");
          if (terms.length > 0) {
            headers["X-JM-Glossary"] = encodeURIComponent(terms.join(","));
          }
        } catch {
          // ignore — glossary is non-critical
        }

        const resp = await fetch("/api/realtime/session", {
          method: "POST",
          headers,
          body: offer.sdp ?? "",
        });

        if (!resp.ok) {
          const errTxt = await resp.text().catch(() => "");
          throw new Error(
            `Errore dal server (${resp.status}). ${errTxt.slice(0, 160)}`,
          );
        }

        const answerSdp = await resp.text();
        if (cancelled) return;

        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

        if (cancelled) return;
        setState("recording");
        startTimer();
        // Keep the screen awake so iOS doesn't sleep mid-recording.
        void acquireWakeLock();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(
          msg.toLowerCase().includes("permission") ||
            msg.toLowerCase().includes("denied")
            ? "Permesso microfono negato. Vai nelle impostazioni del browser e abilitalo."
            : msg,
        );
        setState("error");
      }
    };

    void setup();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEvent(raw: unknown) {
    if (typeof raw !== "string") return;
    let ev: { type?: string; delta?: string; transcript?: string };
    try {
      ev = JSON.parse(raw);
    } catch {
      return;
    }
    if (!ev.type) return;
    if (ev.type === "conversation.item.input_audio_transcription.delta") {
      setInterim((prev) => prev + (ev.delta ?? ""));
      lastTranscriptAtRef.current = Date.now();
      setSilenceWarning(false);
    } else if (
      ev.type === "conversation.item.input_audio_transcription.completed"
    ) {
      const text = ev.transcript ?? "";
      if (text) {
        finalRef.current = (finalRef.current + " " + text).trim();
        setTranscript(finalRef.current);
      }
      setInterim("");
      lastTranscriptAtRef.current = Date.now();
      setSilenceWarning(false);
    }
  }

  // Silence detector: once we're recording, if 8s pass without any
  // transcript event, surface a hint that the mic / environment is not
  // working. Clears once any event arrives.
  useEffect(() => {
    if (state !== "recording") {
      if (silenceTimerRef.current) {
        clearInterval(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }
    lastTranscriptAtRef.current = Date.now();
    silenceTimerRef.current = setInterval(() => {
      if (Date.now() - lastTranscriptAtRef.current > 8000) {
        setSilenceWarning(true);
      }
    }, 1000);
    return () => {
      if (silenceTimerRef.current) {
        clearInterval(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [state]);

  function startTimer() {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function acquireWakeLock() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
      if (!wl) return; // unsupported (older Safari)
      const sentinel = await wl.request("screen");
      wakeLockRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
    } catch {
      // Wake lock can fail (permission, low battery, page not visible).
      // Best-effort only.
    }
  }

  function releaseWakeLock() {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (sentinel && !sentinel.released) {
      void sentinel.release().catch(() => {
        // ignore
      });
    }
  }

  // Re-acquire wake lock when the tab returns to foreground (iOS sometimes
  // releases it on background, and recording continues in foreground).
  useEffect(() => {
    if (state !== "recording") return;
    const onVisChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [state]);

  // Auto-scroll the transcript area to the bottom whenever new content
  // arrives, so the user can always see the latest words (otherwise the
  // current word slides under the waveform/controls).
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    // Slight delay to let the DOM paint the new chunk before measuring.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [transcript, interim]);

  function cleanup() {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    stopTimer();
    releaseWakeLock();
    try {
      dcRef.current?.close();
    } catch {
      // ignore
    }
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    // Intentionally do NOT stop the cached mic tracks — they are shared
    // across overlay open/close so the browser doesn't re-prompt for
    // permission. The tracks get stopped on page unload by the browser.
    try {
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = false; // mute while overlay is closed
      });
    } catch {
      // ignore
    }
  }

  function handleStop() {
    cleanup();
    setState("connecting"); // transient; parent will switch view away
    const finalText = finalRef.current.trim() || interim.trim();
    onStop(finalText, seconds, targetDate);
  }

  function handleCancel() {
    cleanup();
    onCancel();
  }

  function togglePause() {
    const track = audioTrackRef.current;
    if (!track) return;
    if (state === "recording") {
      track.enabled = false;
      stopTimer();
      setState("paused");
    } else if (state === "paused") {
      track.enabled = true;
      startTimer();
      setState("recording");
    }
  }

  const { older, recent } = splitTranscript(transcript);
  const liveLabel =
    state === "paused"
      ? "pausa"
      : state === "connecting"
        ? "connetto"
        : state === "error"
          ? "errore"
          : "live";
  const liveDotOpacity =
    state === "recording" ? 1 : state === "paused" ? 0.45 : 0.6;

  if (!portalReady || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--color-bg-phone)", height: "100dvh" }}
    >
      <div
        className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
        style={{ padding: "24px 24px 0", minHeight: 0 }}
      >
        {/* Live indicator + timer */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ marginBottom: 20 }}
        >
          <div className="flex items-center" style={{ gap: 7 }}>
            <span
              className="inline-block"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  state === "error"
                    ? "var(--color-danger)"
                    : "var(--color-danger)",
                boxShadow: "0 0 10px rgba(248,113,113,0.7)",
                opacity: liveDotOpacity,
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
              {liveLabel}
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

        {/* Date chip — defaults to today, tap to override */}
        <div
          className="flex justify-center shrink-0"
          style={{ paddingBottom: 6 }}
        >
          <button
            type="button"
            className="jm-date-chip"
            onClick={() => setDatePickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={datePickerOpen}
          >
            <svg
              className="icn"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span suppressHydrationWarning>
              <span
                style={{ color: "var(--color-ink)", fontWeight: 600 }}
              >
                {relativeDayLabel(
                  parseISODate(targetDate),
                  parseISODate(todayISO()),
                )}
              </span>
              <span style={{ marginLeft: 5, color: "var(--color-ink-faint)" }}>
                {" . "}
                {compactDayDate(parseISODate(targetDate))}
              </span>
            </span>
            <span className="chev">&#9662;</span>
          </button>
        </div>

        {/* Body */}
        {state === "error" ? (
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
            {errorMessage ?? "Errore sconosciuto."}
          </div>
        ) : (
          <>
            <div
              ref={transcriptScrollRef}
              className="flex-1 overflow-y-auto"
              style={{
                padding: "12px 4px",
                fontSize: 17,
                lineHeight: 1.6,
                minHeight: 0,
              }}
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
              {!transcript && !interim && (
                <p
                  style={{
                    color: "var(--color-ink-faint)",
                    fontStyle: "italic",
                  }}
                >
                  {state === "connecting"
                    ? "Connessione al servizio di trascrizione..."
                    : state === "recording"
                      ? "Parla pure..."
                      : ""}
                </p>
              )}
              {silenceWarning && state === "recording" && (
                <p
                  style={{
                    color: "var(--color-danger)",
                    fontSize: 12,
                    fontStyle: "italic",
                    marginTop: 14,
                    padding: 10,
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.25)",
                    borderRadius: 10,
                  }}
                >
                  non ho ancora sentito parole. avvicinati al microfono o riduci
                  il rumore di sottofondo.
                </p>
              )}
            </div>

            <div className="shrink-0">
              <Waveform active={state === "recording"} />
            </div>
          </>
        )}

        {/* Controls — fixed at bottom of overlay */}
        <div
          className="flex items-center justify-center shrink-0"
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
            disabled={state === "connecting"}
            style={state === "connecting" ? { opacity: 0.5 } : undefined}
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
            disabled={state === "connecting" || state === "error"}
            style={
              state === "connecting" || state === "error"
                ? { opacity: 0.5 }
                : undefined
            }
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
          className="text-center shrink-0"
          style={{
            fontSize: 11,
            color: "var(--color-ink-faint)",
            letterSpacing: "0.04em",
            padding: "10px 0 22px",
          }}
        >
          audio in streaming a openai . solo il testo viene salvato
        </p>
      </div>

      {/* Date picker popover (sits above transcript) */}
      <DatePickerPopover
        open={datePickerOpen}
        selected={targetDate}
        onSelect={(iso) => {
          setTargetDate(iso);
          setDatePickerOpen(false);
        }}
        onClose={() => setDatePickerOpen(false)}
      />
    </div>,
    document.body,
  );
}

function splitTranscript(text: string): { older: string; recent: string } {
  const trimmed = text.trim();
  if (!trimmed) return { older: "", recent: "" };
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
