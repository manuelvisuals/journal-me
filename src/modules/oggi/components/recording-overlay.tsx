"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import {
  compactDayDate,
  formatDurationMmSs,
  parseISODate,
  relativeDayLabel,
  todayISO,
} from "@/lib/format";
import { DatePickerPopover } from "@/modules/oggi/components/date-picker-popover";
import { loadPersonaNames } from "@/lib/data/remembers";
import { useT } from "@/lib/i18n";
import type { DataMode } from "@/lib/data/entries";

// useSyncExternalStore needs a stable subscribe function; we never notify
// because the snapshot is constant after hydration.
function subscribeNoop(): () => void {
  return () => {};
}

// We deliberately do NOT cache the MediaStream module-level. On iOS Safari
// re-using a stream across overlay open/close sessions produces a "stale"
// audio pipe: tracks report readyState=live and enabled=true, but no audio
// frames actually flow after the first close. Modern browsers (incl. iOS
// Safari) don't re-prompt for permission on subsequent getUserMedia calls with
// the same constraints once the user has granted it for the origin, so a fresh
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
// A MediaRecorder started on a still-muted track records silence for as long
// as the mute lasts, which on a first grant is exactly the opening seconds of
// the story. On later launches the permission already exists, the track starts
// unmuted, and everything works. So: if the track is muted, wait for `unmute`
// before arming the recorder. Falls through after a timeout so we never hang if
// the event somehow doesn't fire.
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

const PRIMER_KEY = "journalme-rec-primer";

/**
 * Records the user's voice to a local clip and transcribes it in one shot when
 * he is done, via `/api/transcribe-fallback` (gpt-4o-transcribe).
 *
 * This replaced a live WebRTC session against the OpenAI Realtime API, which
 * streamed audio as it was spoken and printed the words on screen as they
 * arrived. Losing that live text is a real cost, and it was dropped for two
 * reasons:
 *
 * 1. Accuracy. The realtime path cut the audio on a server-side VAD with a
 *    250ms silence threshold — a pause mid-thought could clip a word, and the
 *    model never saw more than a fragment at a time. Sending the whole clip
 *    gives it the full context of the story, which matters most for exactly
 *    the things that were wrong before: proper names.
 * 2. Reliability. The first-launch iOS failure (mic track born `ended`, WebRTC
 *    sender shipping silence, see HANDOVER-recording-bug.md) lived entirely in
 *    the streaming path. MediaRecorder reads the track directly and was already
 *    in this file as the safety net that rescued those sessions — so the net
 *    became the floor.
 *
 * Push-to-talk survives unchanged: the recorder pauses between holds, so
 * background voices in the gaps never make it into the clip. The waveform is
 * still driven by the real mic level, and it is now the only honest signal
 * that he is being heard.
 */
export function RecordingOverlay({
  defaultDate,
  mode,
  onStop,
  onCancel,
  onWriteManually,
}: Props) {
  const t = useT();
  const [seconds, setSeconds] = useState<number>(0);
  const [state, setState] = useState<RecState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string>(
    defaultDate ?? todayISO(),
  );
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  // Live mic stream, exposed so the waveform can read the REAL input level
  // (Web Audio AnalyserNode) instead of a fake animation.
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  // True while the finished clip is being transcribed.
  const [recovering, setRecovering] = useState<boolean>(false);
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
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanedUpRef = useRef<boolean>(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // The recording itself. MediaRecorder reads the mic track directly, which is
  // why it kept working on the iOS first launch where the WebRTC sender did not.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Guards against double-ending if the stop button is tapped twice.
  const endingRef = useRef<boolean>(false);

  function dbg(msg: string) {
    try {
      console.log("[rec]", msg);
    } catch {
      // ignore
    }
  }

  // Acquire the mic and arm the recorder once, on mount.
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        dbg("setup start");
        // 1. Acquire a LIVE mic track. On a cold app launch, iOS Safari can
        // hand back a track that is already `readyState: "ended"`: it produces
        // zero audio frames, so whatever is downstream records silence.
        // Diagnosed live on-device (see HANDOVER-recording-bug.md). The fix: if
        // the track isn't live, discard it and re-call getUserMedia a few times;
        // the re-acquisition reliably returns a live track.
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
            t(
              "Il microfono non si e avviato. Chiudi e riapri, oppure riavvia l'app.",
            ),
          );
        }
        localStreamRef.current = stream;
        setMicStream(stream);
        audioTrackRef.current = stream.getAudioTracks()[0] ?? null;
        const tk = audioTrackRef.current;
        if (tk) {
          tk.addEventListener("mute", () => dbg("track MUTE"));
          tk.addEventListener("unmute", () => dbg("track UNMUTE"));
          tk.addEventListener("ended", () => dbg("track ENDED"));
        }

        // On the first permission grant iOS can also hand back a still-muted
        // (but live) track that delivers no frames until it fires `unmute`.
        // Wait for that before arming, or the clip opens with dead air.
        if (audioTrackRef.current) {
          if (audioTrackRef.current.muted) dbg("track muted -> waiting unmute");
          await waitForTrackLive(audioTrackRef.current);
          dbg(`done waiting muted=${audioTrackRef.current.muted}`);
        }
        if (cancelled) return;

        // 2. Arm the recorder, paused. There is no network handshake to wait
        // for any more: the clip is captured locally and only travels once, at
        // the end. That also means the mic is ready in a few hundred
        // milliseconds instead of after an SDP round trip.
        if (!startTape(stream)) {
          throw new Error(
            t(
              "Questo browser non sa registrare l'audio. Prova a scrivere a mano.",
            ),
          );
        }
        if (cancelled) return;
        setState("paused");
        // Keep the screen awake so iOS doesn't sleep mid-recording.
        void acquireWakeLock();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(
          msg.toLowerCase().includes("permission") ||
            msg.toLowerCase().includes("denied")
            ? t(
                "Permesso microfono negato. Vai nelle impostazioni del browser e abilitalo.",
              )
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

  function cleanup() {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    dbg("cleanup");
    stopTimer();
    releaseWakeLock();
    // Stop the parallel recorder if it's still running (discard path used by
    // cancel / write-manually; handleStop stops it itself first to keep the blob).
    try {
      const r = recorderRef.current;
      recorderRef.current = null;
      if (r && r.state !== "inactive") r.stop();
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

  // --- The recording ------------------------------------------------------
  // Starts armed but paused: nothing is captured until the talk button is held.
  // Returns false if this browser has no MediaRecorder at all, which is now a
  // hard failure rather than a missing safety net.
  function startTape(stream: MediaStream): boolean {
    try {
      if (typeof MediaRecorder === "undefined") return false;
      chunksRef.current = [];
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      let mime = "";
      for (const c of candidates) {
        if (MediaRecorder.isTypeSupported(c)) {
          mime = c;
          break;
        }
      }
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      // Emit a chunk every second so we still have audio even if stop is abrupt.
      rec.start(1000);
      // Armed, but silent until he holds the button. iOS needs the recorder to
      // have actually started before pause() is legal, hence start-then-pause.
      try {
        if (rec.state === "recording") rec.pause();
      } catch {
        // Safari has shipped builds where pause() throws. Falling through means
        // the clip also contains the gaps between holds — worse, not broken.
        dbg("pause unsupported");
      }
      recorderRef.current = rec;
      return true;
    } catch {
      recorderRef.current = null;
      return false;
    }
  }

  function stopTape(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (!rec) {
        resolve(null);
        return;
      }
      const finish = () => {
        try {
          if (!chunksRef.current.length) {
            resolve(null);
            return;
          }
          const type = rec.mimeType || "audio/webm";
          resolve(new Blob(chunksRef.current, { type }));
        } catch {
          resolve(null);
        }
      };
      try {
        if (rec.state !== "inactive") {
          rec.onstop = finish;
          rec.stop();
        } else {
          finish();
        }
      } catch {
        finish();
      }
    });
  }

  // Send the finished clip for transcription. The endpoint is still called
  // /api/transcribe-fallback for historical reasons — it used to be the rescue
  // path — but it is now the only path. Returns "" on any failure; the caller
  // decides what to tell him.
  async function transcribeClip(blob: Blob): Promise<string> {
    const fd = new FormData();
    const ext = blob.type.includes("mp4")
      ? "mp4"
      : blob.type.includes("ogg")
        ? "ogg"
        : "webm";
    fd.set("audio", blob, `entry.${ext}`);
    try {
      const terms = await loadPersonaNames(mode ?? "auth");
      if (terms.length > 0) fd.set("glossary", terms.join(", "));
    } catch {
      // glossary hint is best-effort
    }
    try {
      // A long evening story is a big file on a mountain connection; 30s used
      // to be plenty for a rescue clip and is not, for the whole recording.
      const resp = await apiFetch("/api/transcribe-fallback", {
        timeoutMs: 120_000,
        method: "POST",
        body: fd,
      });
      if (!resp.ok) return "";
      const data = (await resp.json().catch(() => null)) as {
        text?: unknown;
      } | null;
      return data && typeof data.text === "string" ? data.text.trim() : "";
    } catch {
      return "";
    }
  }

  async function handleStop() {
    if (endingRef.current) return; // guard against a double tap
    endingRef.current = true;
    // Close the recording BEFORE tearing the mic down, or the last chunk is lost.
    const blob = await stopTape();
    cleanup();

    // Nothing was captured — he tapped Fine without ever holding the button, or
    // the recorder never produced a chunk. Hand back an empty transcript and let
    // the review screen say so, rather than shipping silence to the model.
    if (!blob || blob.size <= 1200) {
      setState("connecting");
      onStop("", seconds, targetDate);
      return;
    }

    setRecovering(true);
    const text = await transcribeClip(blob);
    setRecovering(false);
    setState("connecting"); // transient; the parent switches the view away
    onStop(text, seconds, targetDate);
  }

  function handleCancel() {
    cleanup();
    onCancel();
  }

  function handleWriteManually() {
    cleanup();
    onWriteManually?.();
  }

  // Push-to-talk: capture only while the button is held. Pausing the recorder
  // (rather than muting the track) means the gaps are absent from the clip
  // entirely — the model never even sees the silence, let alone the voices in it.
  function beginTalk() {
    if (state !== "paused") return; // only once armed & idle
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      if (rec.state === "paused") rec.resume();
    } catch {
      dbg("resume failed");
      return;
    }
    startTimer();
    setState("recording");
  }

  function endTalk() {
    if (state !== "recording") return;
    const rec = recorderRef.current;
    try {
      if (rec && rec.state === "recording") rec.pause();
    } catch {
      dbg("pause failed");
    }
    stopTimer();
    setState("paused");
  }

  // La spiegazione lunga («le parole arrivano quando premi Fine») compare solo
  // al primo utilizzo. Stampata li per sempre, alla seconda volta e rumore e
  // alla decima e un rimprovero.
  const [showPrimer] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      if (localStorage.getItem(PRIMER_KEY)) return false;
      localStorage.setItem(PRIMER_KEY, "1");
      return true;
    } catch {
      return false;
    }
  });

  // Una riga sola che cambia con lo stato, al posto dei quattro messaggi
  // simultanei di prima (etichetta in alto, paragrafo al centro, "Parla
  // pure...", "lascia per fermare"): quando tutto parla, niente si legge.
  const hint =
    state === "connecting"
      ? t("Preparo il microfono.")
      : state === "recording"
        ? t("Lascia per fermare.")
        : seconds > 0
          ? t("Riprendi quando vuoi.")
          : t("Tieni premuto e racconta.");

  const liveLabel =
    state === "paused"
      ? t("pronto")
      : state === "connecting"
        ? t("connetto")
        : state === "error"
          ? t("errore")
          : t("in ascolto");
  const liveDotOpacity =
    state === "recording" ? 1 : state === "paused" ? 0.45 : 0.6;
  // Il rosso significa "sto catturando la tua voce", e nient'altro. Prima era
  // rosso anche su "pronto" e su "connetto", cioe proprio quando il microfono e
  // chiuso: un pallino rosso che lampeggia mentre non registra e una bugia, e
  // per giunta litigava col rosso di Annulla. Fuori dalla registrazione il
  // colore torna quello dei testi secondari, e l'errore resta rosso perche li
  // il rosso vuol dire davvero qualcosa.
  const liveColor =
    state === "recording" || state === "error"
      ? "var(--color-danger)"
      : "var(--color-ink-faint)";

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
        style={{ padding: "0 24px", paddingTop: "calc(24px + env(safe-area-inset-top, 0px))", minHeight: 0 }}
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
                background: liveColor,
                boxShadow:
                  state === "recording" || state === "error"
                    ? "0 0 10px color-mix(in oklab, var(--color-danger) 70%, transparent)"
                    : "none",
                opacity: liveDotOpacity,
              }}
            />
            <span
              style={{
                fontSize: "calc(11px * var(--jm-ui-scale))",
                fontWeight: 650,
                color: liveColor,
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
              fontSize: "calc(18px * var(--jm-ui-scale))",
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
                {" \u00b7 "}
                {compactDayDate(parseISODate(targetDate))}
              </span>
            </span>
            <span className="chev">&#9662;</span>
          </button>
        </div>

        {/* Body */}
        {recovering ? (
          <div
            className="flex flex-1 flex-col items-center justify-center"
            style={{ gap: 14, padding: 24, textAlign: "center" }}
          >
            <span className="jm-dot-pulse" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <p
              style={{
                color: "var(--color-ink)",
                fontSize: "calc(16px * var(--jm-ui-scale))",
                fontWeight: 600,
              }}
            >
              {t("Trascrivo quello che hai detto...")}
            </p>
            <p
              style={{
                color: "var(--color-ink-faint)",
                fontSize: "calc(13px * var(--jm-ui-scale))",
                lineHeight: 1.5,
                maxWidth: 280,
              }}
            >
              {t(
                "Sto mandando la registrazione intera: cosi i nomi propri vengono scritti giusti.",
              )}
            </p>
          </div>
        ) : state === "error" ? (
          <div
            style={{
              padding: 16,
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              background: "var(--color-surface)",
              color: "var(--color-ink-muted)",
              fontSize: "calc(14px * var(--jm-ui-scale))",
              lineHeight: 1.55,
            }}
          >
            {errorMessage ?? t("Errore sconosciuto.")}
          </div>
        ) : (
          /* Un blocco solo, centrato: waveform, microfono, una riga di testo.
             Prima erano quattro elementi che galleggiavano al 35, 57, 64 e 76
             per cento dell'altezza, con due terzi di schermo vuoti in mezzo.
             La waveform e la prima cosa che vedi perche e l'unica che ti dice
             davvero che il microfono ti sente. */
          <div
            className="flex flex-1 flex-col items-center justify-center"
            style={{ gap: 26, minHeight: 0, width: "100%" }}
          >
            <Waveform active={state === "recording"} stream={micStream} />

            <button
              type="button"
              aria-label={t("Tieni premuto per parlare")}
              className="rec-ptt"
              disabled={state === "connecting"}
              onPointerDown={(e) => {
                e.preventDefault();
                beginTalk();
              }}
              onPointerUp={endTalk}
              onPointerLeave={endTalk}
              onPointerCancel={endTalk}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="46"
                height="46"
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
            </button>

            <div style={{ textAlign: "center", minHeight: 40 }}>
              <p
                aria-live="polite"
                style={{ fontSize: "calc(14px * var(--jm-ui-scale))", color: "var(--color-ink-faint)" }}
              >
                {hint}
              </p>
              {showPrimer && state !== "recording" && seconds === 0 && (
                <p
                  style={{
                    fontSize: "calc(12.5px * var(--jm-ui-scale))",
                    color: "var(--color-ink-faint)",
                    opacity: 0.65,
                    marginTop: 6,
                    maxWidth: 250,
                  }}
                >
                  {t("Le parole arrivano quando premi Fine.")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Il fondo: una sola azione, larga tutto. Annulla e la scrittura a
            mano scendono sotto come testo quieto. Buttare via il racconto non
            puo pesare quanto salvarlo, ne stargli accanto sotto il pollice —
            era il cestino spaiato che Manuel ha giustamente contestato. */}
        <div className="shrink-0" style={{ paddingTop: 24 }}>
          <button
            type="button"
            onClick={handleStop}
            className={
              seconds > 0
                ? "jm-ptt-action jm-ptt-save"
                : "jm-ptt-action jm-ptt-save-idle"
            }
            disabled={state === "connecting" || recovering}
            style={{ width: "100%", gap: 8, padding: "16px 22px", fontSize: "calc(15px * var(--jm-ui-scale))" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="19"
              height="19"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t("Fine e salva")}
          </button>

          <div
            className="flex items-center justify-center"
            style={{ paddingTop: 16 }}
          >
            <button type="button" onClick={handleCancel} className="jm-rec-quiet">
              {t("Annulla")}
            </button>
            {onWriteManually && state !== "error" && (
              <>
                <span className="jm-rec-sep" aria-hidden="true">
                  &#183;
                </span>
                <button
                  type="button"
                  onClick={handleWriteManually}
                  className="jm-rec-quiet"
                >
                  {t("Scrivi a mano")}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0" style={{ height: 18 }} />
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

// Waveform driven by the REAL microphone level via a Web Audio AnalyserNode.
// Bars rise with your voice and sit flat in silence — honest feedback, which
// matters in a dictation app where "recording but not heard" is a real failure
// mode. (The old version was a fixed CSS animation that danced even in silence.)
function Waveform({
  active,
  stream,
}: {
  active: boolean;
  stream: MediaStream | null;
}) {
  // 30 barre invece di 13: la waveform e l'unico segnale onesto che il
  // microfono ti sente, e prima era l'elemento piu piccolo della schermata.
  const N = 30;
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !stream) return;
    // Copia locale del ref: al momento della cleanup `barRefs.current` puo
    // gia puntare a un altro array (regola react-hooks/exhaustive-deps).
    const bars = barRefs.current;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    let cancelled = false;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    // Sample the lower half of the spectrum (where speech sits), spread evenly.
    const step = Math.max(1, Math.floor(analyser.frequencyBinCount / 2 / N));

    const loop = () => {
      if (cancelled) return;
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < N; i++) {
        const v = (data[i * step] ?? 0) / 255; // 0..1
        const gated = v < 0.06 ? 0 : v; // noise floor -> truly flat in silence
        const h = 3 + gated * 46;
        const el = barRefs.current[i];
        if (el) {
          el.style.height = `${h.toFixed(1)}px`;
          el.style.opacity = gated > 0 ? "1" : "0.3";
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        source.disconnect();
      } catch {
        // ignore
      }
      try {
        void ctx.close();
      } catch {
        // ignore
      }
      bars.forEach((el) => {
        if (el) {
          el.style.height = "3px";
          el.style.opacity = "0.3";
        }
      });
    };
  }, [active, stream]);

  return (
    <div
      className="flex items-center justify-center"
      style={{ gap: 3, height: 54, width: "100%" }}
      aria-hidden="true"
    >
      {Array.from({ length: N }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          style={{
            width: 3,
            height: 3,
            borderRadius: 2,
            background: "var(--color-accent)",
            opacity: 0.3,
            display: "inline-block",
            transition: "height 60ms linear, opacity 120ms linear",
          }}
        />
      ))}
    </div>
  );
}
