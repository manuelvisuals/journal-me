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
import { loadPersonaNames } from "@/lib/data/remembers";
import type { DataMode } from "@/lib/data/entries";

// useSyncExternalStore needs a stable subscribe function; we never notify
// because the snapshot is constant after hydration.
function subscribeNoop(): () => void {
  return () => {};
}

// We deliberately do NOT cache the MediaStream module-level. On iOS Safari
// re-using a stream across overlay open/close sessions produces a "stale"
// audio pipe: tracks report readyState=live and enabled=true, but the actual
// audio frames stop reaching WebRTC after the first close. The symptom is
// connection OK, state=recording, but OpenAI sees only silence (timer ticks
// up but zero transcription events). Modern browsers (incl. iOS Safari)
// don't re-prompt for permission on subsequent getUserMedia calls with the
// same constraints once the user has granted it for the origin, so a fresh
// acquisition per overlay session is safe and avoids the stale-pipe bug.
async function acquireMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

// iOS Safari quirk (only on the FIRST permission grant): getUserMedia resolves
// while the audio track is still `muted: true`, and iOS doesn't actually push
// audio frames until it fires `unmute` a few hundred ms (sometimes >1s) later.
// If we add this still-muted track to the peer connection and negotiate, the
// RTP sender locks into sending silence — OpenAI's VAD never sees speech, so
// zero transcription events arrive even though the timer ticks (state=recording)
// and the 8s silence warning fires. On later launches the permission already
// exists, the track starts unmuted, and everything works. So: if the track is
// muted, wait for `unmute` before we negotiate. Falls through after a timeout
// so we never hang if the event somehow doesn't fire.
async function waitForTrackLive(
  track: MediaStreamTrack,
  timeoutMs = 3000,
): Promise<void> {
  if (!track.muted) return;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      track.removeEventListener("unmute", finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    track.addEventListener("unmute", finish);
  });
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
  /** Switch from voice to manual typing (tears down the live session first). */
  onWriteManually?: () => void;
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
export function RecordingOverlay({
  defaultDate,
  mode,
  onStop,
  onCancel,
  onWriteManually,
}: Props) {
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

  // --- TEMPORARY DIAGNOSTICS (first-launch silent-recording bug) ---------
  // On-screen log of the recording pipeline so we can see exactly where it
  // breaks on a fresh iOS permission grant: track state, data-channel open,
  // ICE/connection state, every event received from OpenAI, and a periodic
  // getStats() poll of outbound audio (packets/bytes sent + mic audioLevel).
  // If audio bytes climb but no events arrive, the break is server-side;
  // if bytes stay flat, the browser isn't sending audio. Remove once fixed.
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [debugOpen, setDebugOpen] = useState<boolean>(true);
  const debugRef = useRef<string[]>([]);
  const debugT0Ref = useRef<number>(Date.now());
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debugBoxRef = useRef<HTMLDivElement | null>(null);

  function dbg(msg: string) {
    const t = ((Date.now() - debugT0Ref.current) / 1000).toFixed(1);
    const line = `${t}s ${msg}`;
    debugRef.current = [...debugRef.current.slice(-120), line];
    // Defer the state update so the first (synchronous) log during the mount
    // effect doesn't trip React 19's set-state-in-effect rule.
    queueMicrotask(() => setDebugLines(debugRef.current));
    try {
      // eslint-disable-next-line no-console
      console.log("[rec]", line);
    } catch {
      // ignore
    }
  }

  // Setup the realtime connection once on mount.
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        dbg("setup start");
        // 1. Acquire a LIVE mic track. On a cold app launch, iOS Safari can
        // hand back a track that is already `readyState: "ended"` — it produces
        // zero audio frames (pkts/bytes stay 0, lvl 0), so OpenAI sees only
        // silence even though the connection and session are healthy. Diagnosed
        // live on-device (see HANDOVER-recording-bug.md). The fix: if the track
        // isn't live, discard it and re-call getUserMedia a few times; the
        // re-acquisition reliably returns a live track.
        let stream: MediaStream | null = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
          const s = await acquireMicStream();
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          const t = s.getAudioTracks()[0] ?? null;
          dbg(
            t
              ? `getUserMedia #${attempt} muted=${t.muted} enabled=${t.enabled} ready=${t.readyState} "${t.label.slice(0, 20)}"`
              : `getUserMedia #${attempt} NO audio track`,
          );
          if (t && t.readyState === "live") {
            stream = s;
            break;
          }
          // Dead/ended track — throw it away and retry after a short pause so
          // iOS has a moment to bring the capture session up.
          s.getTracks().forEach((t2) => t2.stop());
          await new Promise((r) => setTimeout(r, 300));
          if (cancelled) return;
        }
        if (!stream) {
          throw new Error(
            "Il microfono non si è avviato. Chiudi e riapri, oppure riavvia l'app.",
          );
        }
        localStreamRef.current = stream;
        audioTrackRef.current = stream.getAudioTracks()[0] ?? null;
        const tk = audioTrackRef.current;
        if (tk) {
          tk.addEventListener("mute", () => dbg("track MUTE"));
          tk.addEventListener("unmute", () => dbg("track UNMUTE"));
          tk.addEventListener("ended", () => dbg("track ENDED"));
        }

        // On the first permission grant iOS can also hand back a still-muted
        // (but live) track that delivers no frames until it fires `unmute`.
        // Wait for that before negotiating so the sender doesn't ship silence.
        if (audioTrackRef.current) {
          if (audioTrackRef.current.muted) dbg("track muted -> waiting unmute");
          await waitForTrackLive(audioTrackRef.current);
          dbg(`done waiting muted=${audioTrackRef.current.muted}`);
        }
        if (cancelled) return;

        // 2. Peer connection + data channel
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // Add mic as a transceiver so SDP includes audio
        if (audioTrackRef.current) {
          pc.addTrack(audioTrackRef.current, stream);
          dbg("addTrack done");
        }

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onmessage = (e) => {
          handleEvent(e.data);
        };
        dc.onopen = () => {
          dbg("datachannel OPEN");
        };
        dc.onclose = () => dbg("datachannel close");
        dc.onerror = () => dbg("datachannel error");

        pc.onconnectionstatechange = () => {
          dbg(`pc.connectionState=${pc.connectionState}`);
        };

        pc.oniceconnectionstatechange = () => {
          dbg(`ice=${pc.iceConnectionState}`);
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
          // People saved in Remember feed the transcription model as
          // in-vocabulary proper names (this replaced the old Glossario).
          const terms = await loadPersonaNames(mode ?? "auth");
          if (terms.length > 0) {
            headers["X-JM-Glossary"] = encodeURIComponent(terms.join(","));
          }
        } catch {
          // ignore — vocabulary hint is non-critical
        }

        dbg("POST /api/realtime/session");
        const resp = await fetch("/api/realtime/session", {
          method: "POST",
          headers,
          body: offer.sdp ?? "",
        });
        dbg(`session resp ${resp.status}`);

        if (!resp.ok) {
          const errTxt = await resp.text().catch(() => "");
          throw new Error(
            `Errore dal server (${resp.status}). ${errTxt.slice(0, 160)}`,
          );
        }

        const answerSdp = await resp.text();
        if (cancelled) return;

        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        dbg("remoteDescription set");

        if (cancelled) return;
        setState("recording");
        startTimer();
        startStatsPoll();
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

  // Poll WebRTC stats so we can see whether the browser is actually SENDING
  // audio to OpenAI. If packets/bytes climb, the upstream pipe is healthy and
  // any silence is OpenAI's doing; if they stay flat, the mic track isn't
  // feeding the sender (the suspected first-launch bug).
  function startStatsPoll() {
    if (statsTimerRef.current) return;
    statsTimerRef.current = setInterval(() => {
      const pc = pcRef.current;
      if (!pc) return;
      void pc
        .getStats()
        .then((stats) => {
          let out = "";
          let lvl = "";
          stats.forEach((r) => {
            const rep = r as unknown as {
              type: string;
              kind?: string;
              packetsSent?: number;
              bytesSent?: number;
              audioLevel?: number;
            };
            if (rep.type === "outbound-rtp" && rep.kind === "audio") {
              out = `pkts=${rep.packetsSent ?? "?"} bytes=${rep.bytesSent ?? "?"}`;
            }
            if (rep.type === "media-source" && rep.kind === "audio") {
              lvl =
                typeof rep.audioLevel === "number"
                  ? ` lvl=${rep.audioLevel.toFixed(3)}`
                  : "";
            }
          });
          if (out) dbg(`stats out ${out}${lvl}`);
        })
        .catch(() => {});
    }, 2000);
  }

  function handleEvent(raw: unknown) {
    if (typeof raw !== "string") return;
    let ev: { type?: string; delta?: string; transcript?: string };
    try {
      ev = JSON.parse(raw);
    } catch {
      dbg("event: non-JSON");
      return;
    }
    if (!ev.type) return;
    // Log the type of every event so we can confirm OpenAI is talking back at
    // all (errors, session.created, speech_started, transcription deltas...).
    dbg(`ev ${ev.type}`);
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

  // Keep the diagnostic panel scrolled to the newest line.
  useEffect(() => {
    const el = debugBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [debugLines]);

  function cleanup() {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    dbg("cleanup");
    stopTimer();
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
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
    // Fully stop the mic tracks. Browsers don't re-prompt for permission
    // on subsequent getUserMedia calls for the same origin after the user
    // has granted it, so stopping cleanly here gives us a fresh, healthy
    // audio pipe next time the overlay opens. Disabling-only (as we did
    // before) leaves iOS Safari's audio session in a weird state where
    // subsequent sessions silently fail to deliver audio frames to WebRTC.
    try {
      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore individual track stop errors
        }
      });
    } catch {
      // ignore
    }
    localStreamRef.current = null;
    audioTrackRef.current = null;
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

  function handleWriteManually() {
    cleanup();
    onWriteManually?.();
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
      className="flex flex-col"
      style={{
        // Inline styles to beat the `body > * { position: relative; z-index: 1 }`
        // rule in globals.css (kept there so normal body children stack above
        // the decorative body::before/::after layers). Tailwind classes lose
        // to that selector by specificity once the overlay is a body child.
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "var(--color-bg-phone)",
        height: "100dvh",
      }}
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
              {interim && (
                <p style={{ color: "var(--color-ink)", marginBottom: 10 }}>
                  {interim}
                  {state === "recording" && <span className="live-caret" />}
                </p>
              )}
            </div>

            {/* Status strip: placeholders + silence warning sit ABOVE the
                waveform (Manuel's request — easier to read while talking
                than buried in the transcript scroll area). */}
            <div className="shrink-0" style={{ padding: "0 4px 8px", minHeight: 42 }}>
              {!transcript && !interim && state === "connecting" && (
                <div
                  className="flex items-center justify-center"
                  style={{ gap: 9 }}
                >
                  <span className="jm-dot-pulse" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span
                    style={{
                      color: "var(--color-ink-faint)",
                      fontSize: 13,
                      letterSpacing: "0.01em",
                    }}
                  >
                    preparo il microfono
                  </span>
                </div>
              )}
              {!transcript && !interim && state === "recording" && (
                <p
                  style={{
                    color: "var(--color-ink-faint)",
                    fontSize: 14,
                    fontStyle: "italic",
                    textAlign: "center",
                  }}
                >
                  Parla pure...
                </p>
              )}
              {silenceWarning && state === "recording" && (
                <p
                  style={{
                    color: "var(--color-danger)",
                    fontSize: 12,
                    fontStyle: "italic",
                    padding: "10px 14px",
                    background: "rgba(248,113,113,0.06)",
                    border: "1px solid rgba(248,113,113,0.22)",
                    borderRadius: 12,
                    lineHeight: 1.4,
                    textAlign: "center",
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
            className="rec-ctl rec-ctl-cancel"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
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

        {onWriteManually && state !== "error" && (
          <div className="text-center shrink-0">
            <button
              type="button"
              onClick={handleWriteManually}
              className="jm-write-link"
              style={{ marginTop: 0 }}
            >
              Preferisco scrivere a mano
            </button>
          </div>
        )}

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

      {/* TEMPORARY on-screen diagnostics panel. Toggle with the badge. */}
      <div
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          right: 8,
          zIndex: 60,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto", maxWidth: 440, margin: "0 auto" }}>
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid rgba(248,113,113,0.4)",
              background: "rgba(0,0,0,0.6)",
              color: "var(--color-danger)",
              letterSpacing: "0.06em",
            }}
          >
            {debugOpen ? "DEBUG ▲" : `DEBUG ▼ (${debugLines.length})`}
          </button>
          {debugOpen && (
            <div
              ref={debugBoxRef}
              style={{
                marginTop: 4,
                maxHeight: "38vh",
                overflowY: "auto",
                background: "rgba(0,0,0,0.82)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 8,
                padding: "6px 8px",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 10.5,
                lineHeight: 1.45,
                color: "#e8c9c9",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {debugLines.length === 0 ? (
                <span style={{ opacity: 0.6 }}>in attesa di eventi…</span>
              ) : (
                debugLines.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          )}
        </div>
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
