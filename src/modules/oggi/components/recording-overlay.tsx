"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRitiraDock } from "@/components/ui/dock-sipario";
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
import { conTetto, eTettoScaduto } from "@/lib/tetto";
import { useT } from "@/lib/i18n";
import type { DataMode } from "@/lib/data/entries";
import {
  BLOCCO_TETTO_MS,
  avanzamento,
  bitrateRichiesto,
  chiudereAlRilascio,
  codaDelTesto,
  incisoMs,
  lascia,
  limiteRaggiunto,
  orologioNuovo,
  premi,
  ritmoByteAlSecondo,
  unisciTesti,
  type EsitoBlocco,
  type MotivoChiusura,
  type Orologio,
} from "@/modules/oggi/blocchi";

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
      // Mono: il modello che trascrive riduce comunque tutto a un canale, e
      // il secondo canale era solo peso sul file (blocchi.ts).
      channelCount: 1,
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

/*
 * NIENTE AVVIO AUTOMATICO — MAI. C'e stato per mezza giornata (27 agosto
 * 2026, prop `autoStart`) e Manuel l'ha bocciato provandolo: "devo cliccare
 * e tenere premuto il tasto registra per registrare, push to talk come un
 * walkie talkie". Il motivo e la regola stessa del push-to-talk: si
 * cattura SOLO mentre il dito preme, cosi i bar e i caffe di sottofondo
 * restano fuori dal nastro. Un overlay che parte a registrare da solo
 * registra il locale, non la persona. Se ti viene voglia di rimetterlo,
 * questa nota e qui per fermarti.
 */

type RecState = "connecting" | "recording" | "paused" | "error";

const PRIMER_KEY = "journalme-rec-primer";

/*
 * I tetti della trascrizione (SPEC ospite-e-cassaforte, R11). Il 3 settembre
 * 2026, senza rete, l'app e rimasta su "Trascrivo..." per sempre: la
 * chiamata aveva un tetto di 120 s, ma la lettura del glossario davanti a
 * lei non ne aveva nessuno. Adesso il cronometro e UNO, parte quando si
 * preme Fine e copre tutto: il glossario puo prendersene al massimo
 * GLOSSARIO_TETTO_MS (migliora la trascrizione, non la abilita: se non
 * arriva si trascrive lo stesso), e alla chiamata resta cio che avanza.
 */
const TRASCRIZIONE_TETTO_MS = 120_000;
const GLOSSARIO_TETTO_MS = 4_000;

/*
 * LA REGISTRAZIONE A BLOCCHI (14 settembre 2026, decisione di Manuel).
 *
 * Quella sera 3 minuti e 52 di racconto sono diventati 6,7 MB (226 pezzi a
 * ~29,7 KB/s, la qualita di fabbrica del browser) e il server ha risposto
 * 413: il corpo di una richiesta su Vercel si ferma a ~4,5 MB e il file non
 * e mai arrivato alla funzione che trascrive, che a sua volta ha 60 s di
 * esecuzione. Peso E tempo: un file audio non si taglia dopo (webm e mp4
 * hanno un'intestazione e un indice che reggono tutto), quindi i blocchi si
 * fanno MENTRE si registra, fermando il MediaRecorder e aprendone uno nuovo
 * sulla stessa traccia del microfono. La matematica (quando un blocco e
 * pieno, il tempo che resta, come si cuciono i testi) sta in blocchi.ts,
 * senza import, ed e li che il banco la prova.
 *
 * Il tetto della trascrizione (TRASCRIZIONE_TETTO_MS) e PER BLOCCO: come
 * budget unico dell'intera operazione, cinque blocchi in fila lo avrebbero
 * sfondato e la giornata si sarebbe salvata senza testo, lo stesso danno
 * di quella sera con un'altra faccia.
 *
 * Il taglio ha un prezzo, ed e scritto qui e non nascosto: fermare e
 * riaprire il registratore costa qualche decina di millisecondi. Se il
 * blocco si chiude quando la persona lascia il tasto (cioe in un silenzio,
 * SOGLIA_CHIUSURA_AL_RILASCIO) non se ne accorge nessuno; se parla senza
 * mai lasciare fino al limite, in quel buco una sillaba si perde.
 */

/** Per quanto la riga di stato dice "blocco chiuso" dopo una chiusura automatica. */
const AVVISO_BLOCCO_CHIUSO_MS = 4_000;
/** Ogni quanto si ridisegnano barra e orologio mentre il tasto e premuto. */
const TICK_MS = 250;
/** Sotto questo peso un blocco e vuoto: non si manda a trascrivere. */
const BLOCCO_VUOTO_BYTE = 1200;

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
  /* Superficie a schermo pieno: il dock non esiste finche e aperta
     (dock-sipario.ts). */
  useRitiraDock();
  // Il tempo TOTALE inciso, in secondi, su tutti i blocchi: quello che
  // l'orologio grande mostra e quello che arriva a onStop come durata.
  const [seconds, setSeconds] = useState<number>(0);
  // Il blocco in corso, come lo vede la barra: tempo inciso e byte veri.
  const [blocco, setBlocco] = useState<{ incisoMs: number; byte: number }>({
    incisoMs: 0,
    byte: 0,
  });
  // Quanti blocchi sono gia chiusi (il numero del blocco in corso e +1).
  const [blocchiChiusi, setBlocchiChiusi] = useState<number>(0);
  // Acceso per qualche secondo dopo una chiusura automatica: la riga di
  // stato lo dice, cosi la persona vede che e chiuso e sa che puo
  // continuarne un altro.
  const [avvisoChiuso, setAvvisoChiuso] = useState<number | null>(null);
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
  // I pezzi del blocco IN CORSO (un pezzo al secondo dal MediaRecorder).
  const chunksRef = useRef<Blob[]>([]);
  // I blocchi gia chiusi, in ordine. Se la trascrizione fallisce (rete
  // assente, tempo scaduto) il registratore e gia smontato, ma il racconto
  // e qui: premere di nuovo Fine riprova con questi, invece di dire "non e
  // arrivato audio" e buttare via cio che la persona ha detto.
  const blocchiRef = useRef<Blob[]>([]);
  // Gli esiti gia ottenuti, per indice di blocco: un secondo Fine dopo un
  // errore ritrascrive SOLO i blocchi che mancano, non quelli riusciti.
  const esitiRef = useRef<Map<number, string>>(new Map());
  // LA CATENA: la trascrizione di un blocco parte appena il blocco si chiude,
  // MENTRE si registra il successivo (scelta di Manuel, 15 settembre 2026),
  // cosi a Fine l'attesa e quasi zero. E una catena e non un ventaglio: il
  // blocco N+1 vuole la coda del testo di N come contesto, quindi parte
  // quando N ha risposto. Un blocco si registra in 3 minuti e si trascrive
  // in 10-20 s: la catena non resta mai indietro. L'ordine dei testi non
  // dipende comunque dall'ordine di arrivo (unisciTesti ordina per indice).
  const catenaRef = useRef<Promise<void>>(Promise.resolve());
  // Il glossario si legge UNA volta per registrazione, alla prima chiamata.
  const glossarioRef = useRef<Promise<string> | null>(null);
  // L'orologio del blocco in corso (blocchi.ts): cresce solo col tasto premuto.
  const orologioRef = useRef<Orologio>(orologioNuovo());
  // I byte davvero consegnati per il blocco in corso.
  const byteBloccoRef = useRef<number>(0);
  // Il tempo inciso dei blocchi gia chiusi, sommato.
  const incisoPrimaMsRef = useRef<number>(0);
  // Vero mentre un blocco si sta chiudendo e il successivo aprendo.
  const chiusuraInCorsoRef = useRef<boolean>(false);
  const avvisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against double-ending if the stop button is tapped twice.
  const endingRef = useRef<boolean>(false);

  // --- Diagnostica ---------------------------------------------------------
  // Fino al 24 agosto 2026 una registrazione che non produceva parole era
  // muta in tutti i sensi: `transcribeClip` inghiottiva ogni errore e
  // restituiva "", quindi un permesso negato, una traccia morta, un 402 sul
  // piano e una connessione caduta finivano tutti nella stessa schermata
  // vuota. Su iPhone, dove non c'e una console da aprire, questo rendeva il
  // bug impossibile da localizzare senza tirare a indovinare — e tirare a
  // indovinare e gia costato due giri (vedi HANDOVER-recording-bug.md).
  //
  // Ora ogni passo lascia una riga qui dentro, e quando la registrazione
  // fallisce davvero la riga finisce SULLO SCHERMO insieme al messaggio
  // umano. Non e un pannello di debug da togliere: e la differenza fra
  // "non ha funzionato" e "ho catturato 0 byte in 14 secondi".
  const diagRef = useRef<string[]>([]);
  const chunksStatRef = useRef<{ n: number; bytes: number }>({ n: 0, bytes: 0 });
  const mimeRef = useRef<string>("-");
  const gumRef = useRef<string>("-");
  const httpRef = useRef<string>("-");

  function dbg(msg: string) {
    try {
      diagRef.current.push(msg);
      console.log("[rec]", msg);
    } catch {
      // ignore
    }
  }

  /**
   * Una riga sola, leggibile in uno screenshot, con i quattro numeri che
   * distinguono le cause fra loro:
   *  - `gum`  come e nata la traccia microfono (live/ended, muted o no);
   *  - `mr`   che formato ha scelto MediaRecorder (su iOS e mp4, non webm);
   *  - `n`/`b` quanti pezzi e quanti byte di audio sono stati CATTURATI:
   *           se b=0 il microfono non ha mai consegnato niente e il resto
   *           della pipeline e innocente;
   *  - `http` cosa ha risposto /api/transcribe-fallback (402 = piano,
   *           0/err = la richiesta non e nemmeno partita, es. CORS,
   *           413 = il file era troppo pesante per il server);
   *  - `k`    quanti blocchi audio ha prodotto la registrazione;
   *  - `bps`  il ritmo REALE misurato, byte per secondo di parlato inciso
   *           su tutta la registrazione: e qui che si legge se il telefono
   *           ha rispettato la qualita chiesta (blocchi.ts) o no.
   */
  function diagLine(): string {
    const c = chunksStatRef.current;
    const incisoTot =
      incisoPrimaMsRef.current + incisoMs(orologioRef.current, performance.now());
    const ritmo = ritmoByteAlSecondo({ incisoMs: incisoTot, byte: c.bytes });
    const k = blocchiRef.current.length + (chunksRef.current.length > 0 ? 1 : 0);
    return `gum=${gumRef.current} mr=${mimeRef.current} n=${c.n} b=${c.bytes} http=${httpRef.current} k=${k} bps=${ritmo === null ? "-" : Math.round(ritmo)}`;
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
          if (t) {
            gumRef.current = `#${attempt}/${t.readyState}${t.muted ? "/muted" : ""}`;
          } else {
            gumRef.current = `#${attempt}/no-track`;
          }
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

  /**
   * Ridisegna orologio e barra dal tempo INCISO (blocchi.ts), non da un
   * contatore di tick: un setInterval che salta un colpo sotto carico
   * farebbe segnare meno di quanto e stato registrato davvero.
   */
  function aggiornaVista() {
    const ora = performance.now();
    const inciso = incisoMs(orologioRef.current, ora);
    setBlocco({ incisoMs: inciso, byte: byteBloccoRef.current });
    setSeconds(Math.floor((incisoPrimaMsRef.current + inciso) / 1000));
  }

  function startTimer() {
    if (timerRef.current) return;
    timerRef.current = setInterval(aggiornaVista, TICK_MS);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // L'ultimo aggiornamento a tasto lasciato: la barra si FERMA, non torna
    // indietro e non resta a meta tick.
    aggiornaVista();
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
    if (avvisoTimerRef.current) {
      clearTimeout(avvisoTimerRef.current);
      avvisoTimerRef.current = null;
    }
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
  // Opens the recorder for ONE block. With `attivo` false it starts armed but
  // paused: nothing is captured until the talk button is held. With `attivo`
  // true (the block after an automatic close while the button is still held)
  // it records straight away. Returns false if this browser has no
  // MediaRecorder at all, which is a hard failure rather than a missing
  // safety net.
  function startTape(stream: MediaStream, attivo = false): boolean {
    try {
      if (typeof MediaRecorder === "undefined") return false;
      chunksRef.current = [];
      byteBloccoRef.current = 0;
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
      // La qualita si CHIEDE (Opus 32 kbit/s, AAC 64: blocchi.ts) e poi si
      // MISURA dai pezzi che arrivano: audioBitsPerSecond e una richiesta,
      // Chrome la rispetta e WebKit puo ignorarla. La barra e il limite in
      // byte non si fidano di questo numero, solo dei byte veri.
      const opzioni: MediaRecorderOptions = {
        audioBitsPerSecond: bitrateRichiesto(mime || "audio/webm"),
      };
      if (mime) opzioni.mimeType = mime;
      const rec = new MediaRecorder(stream, opzioni);
      mimeRef.current = rec.mimeType || mime || "default";
      if (blocchiRef.current.length === 0) {
        chunksStatRef.current = { n: 0, bytes: 0 };
      }
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          byteBloccoRef.current += e.data.size;
          const st = chunksStatRef.current;
          st.n += 1;
          st.bytes += e.data.size;
          // Solo il primo pezzo si annota per esteso: e quello che dice se
          // l'audio sta davvero arrivando. I successivi finiscono nei totali.
          if (st.n === 1) dbg(`first chunk ${e.data.size}B`);
          // Il blocco e pieno? Si guarda a ogni pezzo, cioe una volta al
          // secondo, sul tempo inciso E sui byte veri: quello che arriva
          // prima chiude il blocco (blocchi.ts).
          if (recorderRef.current === rec && !chiusuraInCorsoRef.current) {
            const motivo = limiteRaggiunto({
              incisoMs: incisoMs(orologioRef.current, performance.now()),
              byte: byteBloccoRef.current,
            });
            if (motivo) void chiudiBlocco(motivo);
          }
        }
      };
      // Emit a chunk every second so we still have audio even if stop is abrupt.
      rec.start(1000);
      // Armed, but silent until he holds the button. iOS needs the recorder to
      // have actually started before pause() is legal, hence start-then-pause.
      if (!attivo) {
        try {
          if (rec.state === "recording") rec.pause();
        } catch {
          // Safari has shipped builds where pause() throws. Falling through means
          // the clip also contains the gaps between holds — worse, not broken.
          dbg("pause unsupported");
        }
      }
      dbg(
        `armed mime=${mimeRef.current} bps=${opzioni.audioBitsPerSecond} state=${rec.state} blocco=${blocchiRef.current.length + 1}`,
      );
      recorderRef.current = rec;
      return true;
    } catch {
      recorderRef.current = null;
      return false;
    }
  }

  /**
   * Chiude il blocco in corso e ne apre subito un altro sulla stessa
   * traccia del microfono. E l'unico modo: un blob audio gia registrato
   * non si taglia (intestazione e indice reggono tutto il file).
   *
   * `motivo` dice perche: "tempo" o "byte" (limite raggiunto mentre si
   * parla: qui una sillaba puo perdersi, prezzo dichiarato in testa al
   * file) oppure "rilascio" (il tasto e stato lasciato col blocco quasi
   * pieno: il taglio cade in un silenzio e non si sente).
   */
  async function chiudiBlocco(motivo: MotivoChiusura) {
    // Non si guarda cleanedUpRef: in sviluppo React monta, smonta e rimonta
    // lo stesso componente (StrictMode) e quel flag resta acceso dal primo
    // smontaggio. Il segno che il microfono e ancora nostro e la traccia
    // in localStreamRef, che cleanup() azzera.
    if (chiusuraInCorsoRef.current) return;
    const stream = localStreamRef.current;
    if (!stream || !recorderRef.current) return;
    chiusuraInCorsoRef.current = true;
    try {
      const ora = performance.now();
      const eraPremuto = orologioRef.current.premutoDa !== null;
      // L'orologio del blocco si chiude qui: il tratto in corso va nel
      // totale e, se il tasto e ancora premuto, il blocco nuovo parte gia
      // premuto dallo stesso istante.
      const chiuso = lascia(orologioRef.current, ora);
      incisoPrimaMsRef.current += chiuso.incisoMs;
      orologioRef.current = eraPremuto ? premi(orologioNuovo(), ora) : orologioNuovo();
      dbg(
        `blocco ${blocchiRef.current.length + 1} chiuso (${motivo}) inciso=${chiuso.incisoMs}ms byte=${byteBloccoRef.current}`,
      );
      const blob = await stopTape();
      if (blob && blob.size > BLOCCO_VUOTO_BYTE) {
        blocchiRef.current.push(blob);
        accodaTrascrizione(blocchiRef.current.length - 1);
      }
      // Nel frattempo Fine o Annulla possono aver smontato il microfono.
      if (localStreamRef.current !== stream) return;
      // Il tasto puo essere stato lasciato (o premuto) durante lo stop: si
      // riparte nello stato in cui e ADESSO, non in quello di prima.
      const ancoraPremuto = orologioRef.current.premutoDa !== null;
      if (!startTape(stream, ancoraPremuto)) {
        setErrorMessage(
          t("Il microfono si e fermato a meta racconto. Premi Fine per tenere quello che hai detto."),
        );
        setState("error");
        return;
      }
      setBlocchiChiusi(blocchiRef.current.length);
      aggiornaVista();
      if (motivo !== "rilascio") {
        // Chiuso da solo mentre parlava: dirlo per qualche secondo.
        setAvvisoChiuso(blocchiRef.current.length);
        if (avvisoTimerRef.current) clearTimeout(avvisoTimerRef.current);
        avvisoTimerRef.current = setTimeout(
          () => setAvvisoChiuso(null),
          AVVISO_BLOCCO_CHIUSO_MS,
        );
      }
    } finally {
      chiusuraInCorsoRef.current = false;
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
          const out = new Blob(chunksRef.current, { type });
          dbg(`blob ${out.size}B ${type}`);
          resolve(out);
        } catch {
          resolve(null);
        }
      };
      try {
        if (rec.state !== "inactive") {
          rec.onstop = finish;
          // Il push-to-talk lascia SEMPRE il registratore in pausa quando si
          // molla il pulsante, quindi `stop()` arriva quasi sempre su un
          // recorder in pausa. Su Chrome desktop e innocuo — ed e per questo
          // che sul web non si e mai visto niente. WebKit invece ha spedito
          // versioni in cui fermare un MediaRecorder in pausa chiude il file
          // senza scriverlo: zero byte, nessun errore. Riaprire il rubinetto
          // per un istante prima di chiudere costa una frazione di secondo di
          // ambiente e toglie di mezzo quella variabile.
          //
          // ONESTA: questa NON e una causa dimostrata, e un irrobustimento.
          // La prova sta nella diagnostica (`n`/`b` in diagLine): se i byte
          // adesso arrivano, era questo; se restano a zero, il problema e a
          // monte, nella cattura, e questa riga non ha fatto danni.
          if (rec.state === "paused") {
            try {
              rec.resume();
            } catch {
              dbg("resume-before-stop failed");
            }
          }
          rec.stop();
        } else {
          finish();
        }
      } catch {
        finish();
      }
    });
  }

  /**
   * Manda UN blocco a trascrivere. The endpoint is still called
   * /api/transcribe-fallback for historical reasons (it used to be the
   * rescue path) but it is now the only path.
   *
   * Torna il testo (anche "", se il blocco era muto) oppure null se la
   * trascrizione NON e riuscita: le due cose sono diverse e chi unisce i
   * blocchi deve saperle distinguere (blocchi.ts, unisciTesti). Il tetto
   * di tempo e di QUESTO blocco, non dell'intera operazione.
   *
   * `glossario` sono le persone di Ricorda, `contesto` la coda del testo
   * del blocco precedente: tagliando l'audio il modello perde il filo ai
   * bordi, e la cucitura glielo restituisce.
   */
  async function transcribeBlocco(
    blob: Blob,
    glossario: string,
    contesto: string,
  ): Promise<string | null> {
    const fd = new FormData();
    const ext = blob.type.includes("mp4")
      ? "mp4"
      : blob.type.includes("ogg")
        ? "ogg"
        : "webm";
    fd.set("audio", blob, `entry.${ext}`);
    if (glossario) fd.set("glossary", glossario);
    if (contesto) fd.set("contesto", contesto);
    try {
      const resp = await apiFetch("/api/transcribe-fallback", {
        timeoutMs: TRASCRIZIONE_TETTO_MS,
        method: "POST",
        body: fd,
      });
      httpRef.current = String(resp.status);
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        dbg(`transcribe ${resp.status} ${body.slice(0, 120)}`);
        return null;
      }
      const data = (await resp.json().catch(() => null)) as {
        text?: unknown;
      } | null;
      if (!data || typeof data.text !== "string") return null;
      return data.text.trim();
    } catch (err) {
      // Una fetch che non parte proprio (CORS, offline, timeout) arrivava qui
      // e usciva identica a un audio silenzioso. Adesso `http` lo dice.
      const e = err as { name?: string; message?: string };
      httpRef.current = eTettoScaduto(err)
        ? "err:tempo-scaduto"
        : `err:${e?.name ?? "Error"}`;
      dbg(`transcribe threw ${e?.name ?? "Error"} ${e?.message ?? ""}`);
      return null;
    }
  }

  /**
   * Trascrive i blocchi IN ORDINE e cuce i testi. Ogni blocco riceve il
   * glossario e la coda del testo del blocco prima. Un blocco gia riuscito
   * (esitiRef) non si rimanda: un secondo Fine dopo un errore paga solo
   * cio che manca. Un blocco fallito, se almeno un altro e riuscito (cioe
   * la rete c'e), ha un secondo tentativo; se fallisce ancora lascia il
   * segnaposto e il resto del racconto si salva lo stesso.
   */
  function caricaGlossario(): Promise<string> {
    if (!glossarioRef.current) {
      // Il glossario e un aiuto, non una condizione: pochi secondi e poi si
      // parte senza. Era QUESTA l'attesa senza fondo del 3 settembre 2026.
      glossarioRef.current = conTetto(
        loadPersonaNames(mode ?? "auth"),
        GLOSSARIO_TETTO_MS,
        "glossario",
      )
        .then((terms) => (terms.length > 0 ? terms.join(", ") : ""))
        .catch(() => "");
    }
    return glossarioRef.current;
  }

  /**
   * Mette in coda la trascrizione del blocco `indice` sulla catena. Un
   * guasto qui non si mostra (la persona sta ancora parlando): resta un
   * buco in esitiRef e a Fine si riprova con calma.
   */
  function accodaTrascrizione(indice: number) {
    catenaRef.current = catenaRef.current.then(async () => {
      if (esitiRef.current.has(indice)) return;
      const blob = blocchiRef.current[indice];
      if (!blob) return;
      const glossario = await caricaGlossario();
      const prima = indice > 0 ? esitiRef.current.get(indice - 1) : undefined;
      const testo = await transcribeBlocco(
        blob,
        glossario,
        prima ? codaDelTesto(prima) : "",
      );
      if (testo !== null) esitiRef.current.set(indice, testo);
      dbg(`catena: blocco ${indice + 1} ${testo === null ? "fallito" : "trascritto"} durante la registrazione`);
    });
  }

  async function trascriviBlocchi(blocchi: Blob[]) {
    // Prima si aspetta la catena: i blocchi chiusi durante la registrazione
    // sono quasi sempre gia trascritti, e resta da fare solo l'ultimo.
    await catenaRef.current;
    const glossario = await caricaGlossario();
    const esiti: EsitoBlocco[] = [];
    let coda = "";
    for (let i = 0; i < blocchi.length; i++) {
      const gia = esitiRef.current.get(i);
      const testo =
        gia !== undefined
          ? gia
          : await transcribeBlocco(blocchi[i], glossario, coda);
      if (testo !== null) esitiRef.current.set(i, testo);
      esiti.push({ indice: i, testo });
      if (testo) coda = codaDelTesto(testo);
    }
    // Il secondo tentativo, solo per i blocchi mancanti e solo se la rete
    // ha risposto ad almeno uno: senza rete si fallisce subito e si lascia
    // alla persona il Fine di riprova.
    const riusciti = esiti.filter((e) => e.testo !== null).length;
    if (riusciti > 0) {
      for (const e of esiti) {
        if (e.testo !== null) continue;
        const prima = esiti.find((p) => p.indice === e.indice - 1);
        const ctx = prima && prima.testo ? codaDelTesto(prima.testo) : "";
        const testo = await transcribeBlocco(blocchi[e.indice], glossario, ctx);
        if (testo !== null) {
          esitiRef.current.set(e.indice, testo);
          e.testo = testo;
        }
      }
    }
    return unisciTesti(
      esiti,
      t("[qui manca un pezzo del racconto: la trascrizione di questo blocco non e riuscita]"),
    );
  }

  /**
   * Cosa dire quando la trascrizione non e riuscita. La persona deve sempre
   * vedere qualcosa (SPEC R11): cosa e successo e cosa puo fare. I blocchi
   * sono conservati (blocchiRef), quindi "premi di nuovo Fine" e una
   * promessa vera, tranne per il 413, dove ripremere rimanderebbe lo
   * stesso file e fallirebbe identico: li il messaggio deve dire la verita.
   */
  function messaggioTrascrizioneFallita(mb: number): string {
    if (httpRef.current === "413") {
      return [
        t("Il server ha rifiutato la registrazione perche troppo pesante ({mb} MB) e non l'ha nemmeno ascoltata.", {
          mb: mb.toFixed(1).replace(".", ","),
        }),
        t("Premere di nuovo Fine non cambia niente: annulla e racconta di nuovo, a blocchi piu corti."),
      ].join(" ");
    }
    const senzaRete =
      typeof navigator !== "undefined" && navigator.onLine === false;
    const perche = senzaRete
      ? t("Sembra che non ci sia connessione.")
      : httpRef.current === "err:tempo-scaduto"
        ? t("La rete non ha risposto in tempo.")
        : /^\d{3}$/.test(httpRef.current)
          ? t("Il server ha risposto con un errore ({http}).", { http: httpRef.current })
          : "";
    return [
      t("La registrazione c'e, ma non sono riuscito a trascriverla."),
      perche,
      t("Il racconto e ancora qui: premi di nuovo Fine per riprovare."),
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function handleStop() {
    if (endingRef.current) return; // guard against a double tap
    endingRef.current = true;
    // Se un blocco si sta chiudendo proprio adesso, si aspetta che abbia
    // finito: altrimenti il suo ultimo pezzo finirebbe nel vuoto.
    while (chiusuraInCorsoRef.current) {
      await new Promise((r) => setTimeout(r, 50));
    }
    // Il tratto in corso, se il tasto e ancora premuto, si chiude qui.
    orologioRef.current = lascia(orologioRef.current, performance.now());
    // Close the recording BEFORE tearing the mic down, or the last chunk is lost.
    // Se il registratore e gia smontato (Fine premuto dopo un errore di
    // trascrizione) stopTape torna null e si riparte dai blocchi conservati.
    const ultimo = await stopTape();
    if (ultimo && ultimo.size > BLOCCO_VUOTO_BYTE) blocchiRef.current.push(ultimo);
    const durata = Math.floor(
      (incisoPrimaMsRef.current + orologioRef.current.incisoMs) / 1000,
    );
    cleanup();

    const blocchi = blocchiRef.current;
    // Nothing was captured — he tapped Fine without ever holding the button, or
    // the recorder never produced a chunk. Hand back an empty transcript and let
    // the review screen say so, rather than shipping silence to the model.
    if (blocchi.length === 0) {
      // Se non ha mai tenuto premuto, non e successo niente di strano: la
      // schermata di revisione dira che non c'e testo, come prima. Zero
      // blocchi non diventano MAI un racconto salvato.
      if (durata === 0) {
        setState("connecting");
        onStop("", 0, targetDate);
        return;
      }
      // Ma se ha parlato per dei secondi e non e stato catturato NIENTE, il
      // silenzio e il bug. Dirlo, e dire i numeri.
      endingRef.current = false;
      setErrorMessage(
        `${t("Ho tenuto aperto il microfono ma non e arrivato audio. Riprova, e se succede ancora mandami questa riga.")} [${diagLine()}]`,
      );
      setState("error");
      return;
    }

    dbg(`fine: ${blocchi.length} blocchi, ${blocchi.map((b) => b.size).join("+")} byte`);
    setRecovering(true);
    const racconto = await trascriviBlocchi(blocchi);
    setRecovering(false);
    // Audio c'era (i blocchi hanno byte veri) ma non e tornata NESSUNA
    // parola da nessun blocco: o le richieste non sono mai arrivate, o sono
    // state rifiutate. Prima diventava una giornata vuota senza spiegazioni.
    // Con guasti a zero e nessuna parola il racconto era davvero muto.
    if (racconto.riusciti === 0 && racconto.guasti > 0) {
      endingRef.current = false;
      const mb = blocchi.reduce((s, b) => s + b.size, 0) / 1_000_000;
      setErrorMessage(`${messaggioTrascrizioneFallita(mb)} [${diagLine()}]`);
      setState("error");
      return;
    }
    if (racconto.guasti > 0) {
      dbg(`racconto con ${racconto.guasti} blocchi mancanti su ${blocchi.length}`);
    }
    blocchiRef.current = [];
    esitiRef.current = new Map();
    glossarioRef.current = null;
    setState("connecting"); // transient; the parent switches the view away
    onStop(racconto.testo, durata, targetDate);
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
    // Se il registratore e proprio in cambio di blocco (rec null per
    // qualche decina di ms) il tasto premuto viene comunque annotato
    // nell'orologio: il blocco nuovo partira gia attivo (chiudiBlocco).
    if (!rec && !chiusuraInCorsoRef.current) return;
    if (rec) {
      try {
        if (rec.state === "paused") rec.resume();
        // Su WebKit `resume()` puo risolversi senza riaprire il rubinetto: il
        // timer scorre, la waveform balla, e il file resta vuoto. Se lo stato
        // non e tornato "recording" lo si scrive, invece di scoprirlo alla fine.
        if (rec.state !== "recording") dbg(`resume -> state=${rec.state}`);
      } catch {
        dbg("resume failed");
        return;
      }
    }
    // Il tempo inciso parte ADESSO e cresce solo finche il tasto e premuto
    // (blocchi.ts): e il tempo vero di registrazione, non l'orologio a muro.
    orologioRef.current = premi(orologioRef.current, performance.now());
    setAvvisoChiuso(null);
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
    const ora = performance.now();
    orologioRef.current = lascia(orologioRef.current, ora);
    stopTimer();
    setState("paused");
    // Il tasto lasciato e un silenzio: se il blocco e quasi pieno, e QUESTO
    // il momento giusto per chiuderlo, non fra pochi secondi in mezzo a una
    // parola (blocchi.ts, SOGLIA_CHIUSURA_AL_RILASCIO).
    if (
      chiudereAlRilascio({
        incisoMs: incisoMs(orologioRef.current, ora),
        byte: byteBloccoRef.current,
      })
    ) {
      void chiudiBlocco("rilascio");
    }
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
      : avvisoChiuso !== null
        ? t("Blocco {n} chiuso: e al sicuro. Continua pure, il prossimo e gia aperto.", {
            n: String(avvisoChiuso),
          })
        : state === "recording"
          ? t("Lascia per fermare.")
          : seconds > 0
            ? t("Riprendi quando vuoi.")
            : t("Tieni premuto e racconta.");

  /* La barra del blocco: quanto e pieno (tempo inciso O byte veri, il
     maggiore dei due: blocchi.ts) e il tempo inciso su quello massimo. Si
     ferma quando lasci il tasto e riparte quando lo premi, perche il tempo
     che conta e quello inciso. Visibile solo quando c'e un registratore. */
  const bloccoVisibile =
    !recovering && (state === "recording" || state === "paused");
  const bloccoPct = Math.round(avanzamento(blocco) * 100);
  const bloccoInciso = formatDurationMmSs(blocco.incisoMs / 1000);
  const bloccoMax = formatDurationMmSs(BLOCCO_TETTO_MS / 1000);

  const liveLabel =
    state === "paused"
      ? t("pronto")
      : state === "connecting"
        ? t("connetto")
        : state === "error"
          ? t("errore")
          : t("in ascolto");
  // Il pallino di "pronto" e ACCESO, non sbiadito: e una spia, e una spia a
  // mezza opacita non dice niente (10 settembre 2026).
  const liveDotOpacity =
    state === "recording" || state === "paused" ? 1 : 0.6;
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
  /**
   * IL PALLINO ha un colore suo, la scritta no (richiesta di Manuel del 10
   * settembre 2026). Su "pronto" e VERDE — lo stesso verde della batteria in
   * carica di iOS, misurato dallo screenshot: --color-live-ready — perche li
   * il microfono e armato e aspetta te, e una spia verde e la cosa che
   * chiunque legge senza doverla imparare. Resta rosso mentre registra e
   * sull'errore (il rosso vuol dire "sto catturando la tua voce", o
   * "guasto"), e grigio mentre si connette, che non e ne l'uno ne l'altro.
   * La scritta accanto resta del colore dei testi secondari: due cose verdi
   * di fila diventerebbero un avviso, e qui non c'e niente da avvisare.
   */
  const liveDotColor = state === "paused" ? "var(--color-live-ready)" : liveColor;
  /**
   * MENTRE TRASCRIVE LA SPIA SE NE VA (11 settembre 2026, Manuel: "durante
   * la trascrizione non dovrebbe dire READY"). Aveva ragione: in quel
   * momento il microfono e chiuso e la registrazione e gia finita, quindi
   * "pronto" e falso due volte, e il pallino verde dice "ti ascolto" mentre
   * nessuno ascolta. La regola che si applica qui e quella di Apple: un
   * elemento di stato che non ha piu niente di vero da dire SPARISCE, non si
   * riempie di parole nuove. Cosa sta succedendo lo dice gia, in grande, il
   * centro dello schermo. Resta solo la durata, spenta: e l'unico fatto
   * ancora vero, cioe quanto hai registrato.
   */
  const spiaVisibile = !recovering;

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
          <div
            className="flex items-center"
            style={{ gap: 7, visibility: spiaVisibile ? "visible" : "hidden" }}
            aria-hidden={spiaVisibile ? undefined : true}
          >
            <span
              className="inline-block"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: liveDotColor,
                boxShadow:
                  state === "recording" || state === "error"
                    ? "0 0 10px color-mix(in oklab, var(--color-danger) 70%, transparent)"
                    : state === "paused"
                      ? "0 0 10px color-mix(in oklab, var(--color-live-ready) 55%, transparent)"
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
              opacity: recovering ? 0.5 : 1,
            }}
          >
            {formatDurationMmSs(seconds)}
          </span>
        </div>

        {/* Il blocco in corso: barra + orologio del blocco. La persona sa
            PRIMA di cominciare quanto dura un blocco (00:00 / 03:00), non lo
            scopre quando e troppo tardi. */}
        <div
          className={
            "jm-rec-blocco shrink-0" + (bloccoVisibile ? "" : " jm-rec-blocco-nascosta")
          }
          aria-hidden={bloccoVisibile ? undefined : true}
        >
          <div
            className="jm-rec-blocco-barra"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={bloccoPct}
            aria-label={t("Blocco {n}", { n: String(blocchiChiusi + 1) })}
          >
            <i style={{ width: `${bloccoPct}%` }} />
          </div>
          <div className="jm-rec-blocco-riga">
            <span>{t("Blocco {n}", { n: String(blocchiChiusi + 1) })}</span>
            <span className="jm-rec-blocco-tempo">
              {bloccoInciso}
              <span className="jm-rec-blocco-max">{" / " + bloccoMax}</span>
            </span>
          </div>
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
                  {t("Le parole arrivano quando premi Fine. Ogni blocco dura al massimo {min} minuti di parlato: quando e pieno si chiude da solo e continui nel prossimo.", {
                    min: String(Math.round(BLOCCO_TETTO_MS / 60_000)),
                  })}
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
