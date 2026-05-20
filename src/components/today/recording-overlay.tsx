"use client";

import { useEffect, useRef, useState } from "react";
import { formatDurationMmSs } from "@/lib/format";

type Props = {
  onStop: (transcript: string, durationSeconds: number) => void;
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
export function RecordingOverlay({ onStop, onCancel }: Props) {
  const [transcript, setTranscript] = useState<string>("");
  const [interim, setInterim] = useState<string>("");
  const [seconds, setSeconds] = useState<number>(0);
  const [state, setState] = useState<RecState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs to objects that must survive across renders without triggering effects.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const finalRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanedUpRef = useRef<boolean>(false);

  // Setup the realtime connection once on mount.
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        // 1. Mic permission
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
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

        const resp = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
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
      // Interim — append to local interim buffer
      setInterim((prev) => prev + (ev.delta ?? ""));
    } else if (
      ev.type === "conversation.item.input_audio_transcription.completed"
    ) {
      // Final chunk — append to accumulator, clear interim
      const text = ev.transcript ?? "";
      if (text) {
        finalRef.current = (finalRef.current + " " + text).trim();
        setTranscript(finalRef.current);
      }
      setInterim("");
    }
    // We ignore other event types (errors, ping, etc.) — could log if needed.
  }

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

  function cleanup() {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    stopTimer();
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
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
  }

  function handleStop() {
    cleanup();
    setState("connecting"); // transient; parent will switch view away
    const finalText = finalRef.current.trim() || interim.trim();
    onStop(finalText, seconds);
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
        <div
          className="flex items-center justify-between"
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
            </div>

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
          className="text-center"
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
    </div>
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
