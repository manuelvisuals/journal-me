"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { EmptyState } from "@/components/today/empty-state";
import { RecordingOverlay } from "@/components/today/recording-overlay";
import { FilledView } from "@/components/today/filled-view";
import { TranscriptEditor } from "@/components/today/transcript-editor";
import { ReviewScreen } from "@/components/today/review-screen";
import { ManualWrite } from "@/components/today/manual-write";
import { PeopleReview } from "@/components/today/people-review";
import { DesktopEditor } from "@/components/today/desktop-editor";
import { RailToday } from "@/components/today/rail-today";
import { FocusToggle, setFocusMode } from "@/components/desktop/focus-toggle";
import { useIsDesktop } from "@/components/desktop/use-is-desktop";
import { openPremiumWall } from "@/components/premium-wall";
import { useCan } from "@/lib/capabilities";
import { clearDraft, loadDraft } from "@/lib/data/drafts";
import { formatDayHeader, formatNumber, todayISO } from "@/lib/format";
import { warmRealtime } from "@/lib/realtime/prewarm";
import { useStorageMode } from "@/lib/data/store";
import {
  deleteEntry,
  loadEntryForDate,
  toggleGoal,
  updateEntryTranscript,
  updateMetric,
  type DataMode,
} from "@/lib/data/entries";
import { saveRecording } from "@/lib/actions/save-recording";
import { addPersonas, loadPersonaNames } from "@/lib/data/remembers";
import { useT } from "@/lib/i18n";
import { useOptimisticGoals } from "@/lib/use-optimistic-goals";
import { ChiarimentiScreen } from "@/components/today/chiarimenti-screen";
import {
  applicaRisposte,
  chiediChiarimenti,
  type Domanda,
  type Risposta,
} from "@/lib/chiarimenti";
import { indicizza, risolviLista } from "@/lib/aliases";
import {
  scansionaArchivio,
  scansioneGiaFatta,
} from "@/lib/actions/scan-archivio";
import { bastaPerOra, domandeInSospeso, metteInPausa } from "@/lib/chiarimenti";
import { loadAliases } from "@/lib/data/facts";
import { useDayLists } from "@/lib/use-day-lists";
import type {
  Entry,
  EntryMetrics,
  FactKind,
  GoalDef,
  GoalDot,
} from "@/lib/types";

type View =
  | "empty"
  | "recording"
  | "manual"
  | "no-capture"
  | "review"
  | "processing"
  | "chiarimenti"
  | "people"
  | "filled";

type PendingRecording = {
  transcript: string;
  durationSeconds: number;
  targetDate: string;
};

type PeopleData = {
  existing: string[];
  suggested: string[];
  attachDate: string;
  /** The real saved entry for attachDate (has headline) — used as the view
   *  base after attaching people, so we never render a headline-less shell. */
  entryForDate: Entry | null;
};

type Props = {
  mode: DataMode;
  initialEntry: Entry | null;
  /** Live micro-goal definitions from the DB (no hardcoded fallback). */
  goalDefs: GoalDef[];
  /** If true, the recording overlay opens immediately on mount (?record=1). */
  autoRecord?: boolean;
};

/**
 * I nomi per cui hai gia detto "non ora".
 *
 * Serve perche adesso i nomi si rileggono da tutto il testo a ogni
 * salvataggio: senza memoria del rifiuto, la stessa domanda tornerebbe a
 * ogni riga che aggiungi alla giornata. Sta nel dispositivo, come le altre
 * preferenze, e non e un dato del diario.
 */
const DECLINED_KEY = "jm:persone-rifiutate";

function declinedPeople(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DECLINED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function declinePeople(names: readonly string[]): void {
  try {
    const set = declinedPeople();
    for (const n of names) set.add(n.trim().toLowerCase());
    window.localStorage.setItem(DECLINED_KEY, JSON.stringify([...set]));
  } catch {
    // storage negato: al massimo la domanda ricompare
  }
}

export function TodayClient({
  mode,
  initialEntry,
  goalDefs,
  autoRecord = false,
}: Props) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Voce e AI sono capability (PR 10): spente in locale E in cloud gratis.
  // Toccare il microfono senza la capability apre il muro premium, con la
  // scrittura a mano come uscita gratuita (mockup due-modalita §04). La
  // decisione vera resta comunque sul server (402).
  const storageMode = useStorageMode();
  const isLocalMode = storageMode === "local";
  const canVoice = useCan("voice");
  const canAI = useCan("aiSummary");
  const [entry, setEntry] = useState<Entry | null>(initialEntry);
  const optimisticGoals = useOptimisticGoals();
  const [view, setView] = useState<View>(
    autoRecord
      ? canVoice
        ? "recording"
        : "manual"
      : initialEntry
        ? "filled"
        : "empty",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingRecording | null>(null);
  const [peopleData, setPeopleData] = useState<PeopleData | null>(null);
  const [peopleSaving, setPeopleSaving] = useState<boolean>(false);
  // Le domande dell'AI e la giornata a cui si riferiscono.
  const [chiarimenti, setChiarimenti] = useState<{
    domande: Domanda[];
    attachDate: string;
    entryForDate: Entry | null;
  } | null>(null);
  // Un soprannome appena chiarito deve vedersi SUBITO, senza ricaricare la
  // pagina. I soprannomi si ricaricano quando cambia la giornata, ma
  // rispondere a una domanda non sempre cambia la giornata: puo scrivere
  // solo l'alias. Questo contatore e l'altro motivo per rileggerli.
  const [aliasRev, setAliasRev] = useState(0);

  // --- editor desktop + bozze (PR 7, SPEC-v2 §5.3/§6) ---
  const isDesktop = useIsDesktop();
  const [draftInitial, setDraftInitial] = useState<string>("");
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState<number>(0);
  const [edWords, setEdWords] = useState<number>(0);
  const [edSavedAt, setEdSavedAt] = useState<number | null>(null);
  const viewRef = useRef<View>(view);
  const edWordsRef = useRef<number>(0);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    edWordsRef.current = edWords;
  }, [edWords]);

  // Al mount di Oggi: se esiste una bozza per la data corrente piu recente
  // della giornata salvata, l'editor si riapre con quel testo (§6). Non
  // scavalca una registrazione in corso ne battute gia scritte.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await loadDraft(todayISO());
      if (cancelled || !draft) return;
      if (initialEntry && draft.updatedAt <= initialEntry.createdAt) return;
      const v = viewRef.current;
      if (v !== "empty" && v !== "filled" && v !== "manual") return;
      if (edWordsRef.current > 0) return;
      setDraftInitial(draft.text);
      setDraftNotice(t("bozza non salvata, recuperata"));
      setEditorKey((k) => k + 1);
      setView("manual");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prewarm the transcription path the moment Today loads, so the mic feels
  // instant when the user records. Best-effort, never touches the mic. SOLO
  // con la capability voce: in gratis non si scalda niente (e un 402 di
  // background aprirebbe il muro all'avvio, vietato dal mockup §04).
  useEffect(() => {
    if (canVoice) warmRealtime();
  }, [canVoice]);

  // Watch for ?record=1 changes coming from clicking the mic in the tab bar
  // while we're already on /. Defer the setState via queueMicrotask so React
  // 19's react-hooks/set-state-in-effect rule is satisfied.
  useEffect(() => {
    if (searchParams.get("record") !== "1") return;
    queueMicrotask(() => {
      if (!canVoice) {
        if (isLocalMode) {
          // In locale il link della rail dice "Scrivi la giornata": si
          // scrive, senza muri.
          setView((current) => (current === "manual" ? current : "manual"));
        } else {
          openPremiumWall("voice", () => setView("manual"));
        }
        router.replace("/", { scroll: false });
        return;
      }
      warmRealtime();
      setView((current) => (current === "recording" ? current : "recording"));
      router.replace("/", { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const dayHeader = formatDayHeader();

  // Goals to render: the entry's own goal state if present, otherwise the
  // live definitions rendered all-off. No hardcoded list anywhere.
  // La spunta appena toccata vince sul dato salvato finche il salvataggio
  // non torna: vedi src/lib/use-optimistic-goals.ts.
  const goalsForView: GoalDot[] = optimisticGoals.view(
    entry?.goals && entry.goals.length > 0
      ? entry.goals
      : goalDefs.map((d) => ({ id: d.id, label: d.label, on: false })),
  );

  // La giornata mostrata da Oggi non e sempre quella di oggi: se hai
  // raccontato dopo mezzanotte, l'entry appartiene a ieri. I luoghi vanno
  // letti dalla data dell'entry, non dal calendario.
  const dateVista = entry?.entryDate ?? todayISO();
  // Vedi day-client: soprannomi e cose tolte si applicano quando si mostra.
  const liste = useDayLists(
    mode,
    dateVista,
    entry?.people ?? [],
    `${entry?.transcript ?? ""}|${aliasRev}`,
  );
  const [tolte, setTolte] = useState<{ kind: FactKind; nome: string }[]>([]);

  /**
   * All'apertura dell'app: se c'e qualcosa da chiarire, lo chiede.
   *
   * Due cose in un effetto solo, e sono in fila per forza:
   *
   *   1. se e la prima volta da premium, l'AI legge tutto il diario
   *      (src/lib/actions/scan-archivio.ts) — le giornate scritte gratis non
   *      le ha mai lette nessuno;
   *   2. poi guarda la coda e chiede.
   *
   * IL PASSO 2 VALE SEMPRE, non solo dopo una scansione, e questa e la
   * correzione del 23 agosto sera: le domande comparivano solo subito dopo
   * un'analisi. Riaprendo l'app le cinque domande in coda restavano li in
   * silenzio, e la regola di Manuel — "le richiede a sfinimento finche
   * l'utente non risponde a tutto" — era vera solo il primo minuto.
   *
   * "Basta per adesso" mette in pausa fino alla prossima apertura, non di
   * piu: e cio che dice il tasto.
   */
  useEffect(() => {
    if (!canAI) return;
    let vivo = true;
    void (async () => {
      try {
        if (!scansioneGiaFatta()) await scansionaArchivio(mode);
        if (!vivo || bastaPerOra()) return;
        const coda = await domandeInSospeso(mode);
        if (!vivo || coda.length === 0) return;
        setChiarimenti({
          domande: coda,
          attachDate: entry?.entryDate ?? todayISO(),
          entryForDate: entry,
        });
        setView((v) =>
          // Non si interrompe chi sta gia raccontando o scrivendo: le
          // domande aspettano, sono in coda apposta.
          v === "filled" || v === "empty" ? "chiarimenti" : v,
        );
      } catch {
        // Niente domande: si scrive lo stesso. Non e questa la funzione per
        // cui uno apre il diario.
      }
    })();
    return () => {
      vivo = false;
    };
    // Volutamente senza `entry`: parte all'apertura, non a ogni salvataggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAI, mode]);

  const handleStartRecording = () => {
    setSaveError(null);
    setSavedDates([]);
    if (!canVoice) {
      // Il muro compare solo qui, quando TU tocchi il microfono. "Non ora"
      // resta un'uscita gratuita: si apre la scrittura a mano.
      openPremiumWall("voice", () => setView("manual"));
      return;
    }
    warmRealtime();
    setView("recording");
  };

  const handleWriteManually = () => {
    setSaveError(null);
    setSavedDates([]);
    setView("manual");
  };

  // Manual text follows the exact same pipeline as a recording.
  const handleManualContinue = (text: string) => {
    setPending({ transcript: text, durationSeconds: 0, targetDate: todayISO() });
    setView("review");
  };

  // Stop recording -> review screen so the user can correct typos / proper
  // names before the AI processes the transcript.
  const handleStop = (
    transcript: string,
    durationSeconds: number,
    targetDate: string,
  ) => {
    if (!transcript.trim()) {
      setPending({ transcript: "", durationSeconds, targetDate });
      setView("no-capture");
      return;
    }
    setPending({ transcript, durationSeconds, targetDate });
    setView("review");
  };

  // Pipeline unica di salvataggio (voce con review, testo a mano, editor
  // desktop). withAI=false e il "salva e basta" di Cmd+S (§5.4): il testo
  // resta com'e, la prima riga fa da titolo, zero chiamate AI.
  const runSave = async (
    text: string,
    opts: { withAI: boolean; durationSeconds: number; targetDate: string },
  ) => {
    setView("processing");
    try {
      const saved = await saveRecording({
        transcript: text,
        durationSeconds: opts.durationSeconds,
        defaultDate: opts.targetDate,
        skipAI: !opts.withAI,
      });
      // Giornata salvata davvero: SOLO ora la bozza si cancella (§6).
      await clearDraft(opts.targetDate);
      setDraftInitial("");
      setDraftNotice(null);
      setEdWords(0);
      setEdSavedAt(null);
      setEditorKey((k) => k + 1);
      // Giornata chiusa: si torna all'interfaccia completa.
      setFocusMode(false);

      const today = todayISO();
      const todayEntry = saved.find((e) => e.entryDate === today) ?? null;
      if (todayEntry) setEntry(todayEntry);
      setSavedDates(saved.map((e) => e.entryDate));

      // I nomi sono GIA sulla giornata: li ha letti l'analisi, sul testo
      // completo, insieme al riassunto (src/lib/actions/analyze-day.ts).
      // Qui non si chiede piu chi c'era - lo sappiamo - si chiede solo se
      // le facce nuove vanno aggiunte alla rubrica di Ricorda. E una
      // domanda diversa, ed e l'unica che ha ancora bisogno di una persona.
      const attachDate = todayEntry
        ? today
        : saved[0]?.entryDate ?? opts.targetDate;
      const entryForDate =
        saved.find((e) => e.entryDate === attachDate) ?? todayEntry ?? null;

      // PRIMA i chiarimenti, POI la rubrica, e l'ordine non e casuale: se
      // "mio fratello" diventa Daniele adesso, la domanda dopo offre di
      // salvare Daniele. Al contrario si finirebbe con "mio fratello" nella
      // rubrica delle persone, che e esattamente il difetto di partenza.
      // `canAI`, non `opts.withAI`: il secondo dice cosa e stato CHIESTO, il
      // primo dice se l'AI c'e davvero. In modalita locale la scrittura a
      // mano passa comunque da withAI=true, e chiedere dei chiarimenti a
      // un'AI che non esiste voleva dire una richiesta buttata a ogni
      // giornata scritta da un utente gratis.
      if (canAI && entryForDate) {
        const domande = await chiediChiarimenti(mode, attachDate, entryForDate.transcript, {
          people: entryForDate.people ?? [],
          areas: entryForDate.areas ?? [],
        });
        if (domande.length > 0) {
          setChiarimenti({ domande, attachDate, entryForDate });
          setPending(null);
          setView("chiarimenti");
          return;
        }
      }

      await vaiAlPassoPersone(attachDate, entryForDate);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Errore nel salvataggio"));
      setPending(null);
      setView("empty");
    }
  };

  /**
   * Il passo della rubrica: le facce nuove vanno salvate in Ricorda?
   *
   * I nomi sono GIA sulla giornata (li ha letti l'analisi sul testo
   * completo). Qui non si chiede piu chi c'era: si chiede solo chi entra in
   * rubrica. E se una schermata di chiarimenti e appena passata, i nomi che
   * arrivano qui sono gia quelli veri.
   */
  const vaiAlPassoPersone = async (
    attachDate: string,
    entryForDate: Entry | null,
  ) => {
    const found = entryForDate?.people ?? [];
    if (found.length > 0) {
      const [roster, aliasList] = await Promise.all([
        loadPersonaNames(mode),
        loadAliases(mode).catch(() => []),
      ]);
      // I soprannomi appena chiariti valgono da subito: se hai appena detto
      // che "mio fratello" e Daniele, in rubrica ci va Daniele.
      const veri = risolviLista(found, "persona", indicizza(aliasList));
      const rosterLower = new Set(roster.map((r) => r.toLowerCase()));
      const declined = declinedPeople();
      const existing = veri.filter((p) => rosterLower.has(p.toLowerCase()));
      const suggested = veri.filter(
        (p) =>
          !rosterLower.has(p.toLowerCase()) && !declined.has(p.toLowerCase()),
      );
      // Niente da decidere, niente schermata: se sono tutti gia in rubrica
      // (o li hai gia rifiutati una volta), fermare l'utente per fargli
      // premere "ok" e solo un ostacolo.
      if (suggested.length > 0) {
        setPeopleData({ existing, suggested, attachDate, entryForDate });
        setPending(null);
        setView("people");
        return;
      }
    }
    setPending(null);
    setView(entryForDate || entry ? "filled" : "empty");
  };

  /**
   * Le risposte alle domande. I soprannomi valgono per sempre, le aree solo
   * per questa giornata: vedi src/lib/chiarimenti.ts.
   */
  /**
   * Una risposta, applicata subito.
   *
   * Le domande arrivano da giornate diverse, quindi ognuna si applica alla
   * SUA — non a quella che si sta guardando. Per le domande di identita non
   * cambia niente (valgono ovunque), per quelle di area e tutto: mettere la
   * piscina del 19 fra le aree del 23 sarebbe scrivere il falso.
   */
  const applicaUnaRisposta = async (r: Risposta) => {
    const dataDomanda = r.domanda.entryDate;
    try {
      const suaEntry =
        dataDomanda === entry?.entryDate
          ? entry
          : await loadEntryForDate(mode, dataDomanda);
      const aggiornata = await applicaRisposte(mode, dataDomanda, suaEntry, [r]);
      if (aggiornata && aggiornata.entryDate === entry?.entryDate) {
        setEntry(aggiornata);
      }
      setAliasRev((n) => n + 1);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t("Errore salvataggio persone"),
      );
    }
  };

  const finishChiarimenti = async () => {
    if (!chiarimenti) return;
    const { attachDate, entryForDate } = chiarimenti;
    setChiarimenti(null);
    setAliasRev((n) => n + 1);
    await vaiAlPassoPersone(attachDate, entryForDate);
  };

  // User confirmed the (possibly corrected) transcript — same pipeline.
  const handleConfirmReview = async (finalTranscript: string) => {
    if (!pending) return;
    await runSave(finalTranscript, {
      withAI: true,
      durationSeconds: pending.durationSeconds,
      targetDate: pending.targetDate,
    });
  };

  const finishPeople = async (allPeople: string[], newOnes: string[]) => {
    if (!peopleData) return;
    const { attachDate, entryForDate } = peopleData;
    setPeopleSaving(true);
    try {
      if (newOnes.length > 0) {
        await addPersonas(mode, newOnes);
      }
      // La giornata NON si tocca: le sue persone sono il risultato della
      // lettura del testo, e il testo e l'unica autorita (decisione del 21
      // agosto 2026). Qui si e appena deciso chi entra in rubrica.
      const base = entryForDate;
      const showToday = attachDate === todayISO();
      if (base && showToday) setEntry(base);
      setPeopleData(null);
      setPeopleSaving(false);
      setView((base && showToday) || entry ? "filled" : "empty");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t("Errore salvataggio persone"),
      );
      setPeopleData(null);
      setPeopleSaving(false);
      setView(entry ? "filled" : "empty");
    }
  };

  const handleCancelReview = () => {
    setPending(null);
    setView(entry ? "filled" : "empty");
  };

  const handleCancel = () => {
    setView(entry ? "filled" : "empty");
  };

  const handleMetricChange = async (patch: Partial<EntryMetrics>) => {
    const dateISO = entry?.entryDate ?? todayISO();
    try {
      const updated = await updateMetric(mode, dateISO, patch);
      setEntry(updated);
      // Su desktop, mentre si scrive, la colonna resta l'editor: toccare
      // una metrica o un obiettivo dalla rail non deve chiuderlo.
      if (view === "empty" && !isDesktop) setView("filled");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Errore nel salvataggio"));
    }
  };

  const handleGoalToggle = async (label: string) => {
    const dateISO = entry?.entryDate ?? todayISO();
    await optimisticGoals.toggle(goalsForView, label, async () => {
      try {
        const updated = await toggleGoal(mode, dateISO, label);
        setEntry(updated);
        // Su desktop, mentre si scrive, la colonna resta l'editor: toccare
        // una metrica o un obiettivo dalla rail non deve chiuderlo.
        if (view === "empty" && !isDesktop) setView("filled");
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : t("Errore nel salvataggio"),
        );
      }
    });
  };

  const handleEditorDelete = async () => {
    if (!entry) return;
    try {
      await deleteEntry(mode, entry.entryDate);
      setEntry(null);
      setEditorOpen(false);
      setSavedDates([]);
      setView("empty");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Errore eliminazione"));
    }
  };

  const handleEditorSave = async (newTranscript: string) => {
    if (!entry) return;
    setEditorOpen(false);
    setView("processing");
    try {
      const updated = await updateEntryTranscript(
        mode,
        entry.entryDate,
        newTranscript,
      );
      setEntry(updated);
      setView("filled");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Errore nel salvataggio"));
      setView(entry ? "filled" : "empty");
    }
  };

  const multiDayNotice =
    savedDates.length > 1
      ? t("Salvato su {n} giorni", { n: savedDates.length })
      : null;

  // Da lg in su la colonna centrale E l'editor (mockup desktop-v1 §01):
  // niente overlay, si arriva su Oggi e si scrive.
  const desktopWriting = isDesktop && (view === "empty" || view === "manual");
  const aiAvailable = canAI;

  const handleDesktopSaveOnly = (text: string) => {
    void runSave(text, {
      withAI: false,
      durationSeconds: 0,
      targetDate: todayISO(),
    });
  };
  const handleDesktopSaveAI = (text: string) => {
    void runSave(text, {
      withAI: true,
      durationSeconds: 0,
      targetDate: todayISO(),
    });
  };

  return (
    <main
      className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
    >
      {/* Il padding sta in .jm-col-head (globals.css), non qui: da uno
          style inline non si puo scavalcare con una media query, e su
          desktop questo margine deve coincidere con quello dell'editor. */}
      <header className="jm-col-head flex items-baseline justify-between">
        <span
          suppressHydrationWarning
          style={{
            fontSize: "calc(11px * var(--jm-ui-scale))",
            fontWeight: 600,
            color: "var(--color-ink-faint)",
            letterSpacing: "0.20em",
            textTransform: "uppercase",
          }}
        >
          {dayHeader}
        </span>
        {desktopWriting && (
          <div className="jm-ed-meta">
            <span suppressHydrationWarning>
              {edWords > 0 ? `${formatNumber(edWords)} parole` : " "}
              {edSavedAt !== null && <SavedAgo key={edSavedAt} ts={edSavedAt} />}
            </span>
            <FocusToggle />
          </div>
        )}
        {view === "filled" && (
          <div className="flex items-center" style={{ gap: 14 }}>
            <button
              type="button"
              onClick={() => entry && setEditorOpen(true)}
              disabled={!entry}
              style={{
                fontSize: "calc(12px * var(--jm-ui-scale))",
                color: "var(--color-accent)",
                fontWeight: 600,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: entry ? "pointer" : "default",
                opacity: entry ? 1 : 0.5,
                fontFamily: "inherit",
              }}
            >
              {t("modifica")} &#8599;
            </button>
            <button
              type="button"
              onClick={handleWriteManually}
              aria-label={t("Scrivi a mano")}
              className="jm-rerecord-btn"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="17"
                height="17"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleStartRecording}
              aria-label={t("Registra di nuovo")}
              className="jm-rerecord-btn"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {multiDayNotice && view === "filled" && (
        <div
          style={{
            margin: "0 24px 8px",
            padding: "8px 12px",
            border: "1px solid color-mix(in oklab, var(--color-success) 30%, transparent)",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--color-success) 6%, transparent)",
            color: "var(--color-success)",
            fontSize: "calc(12px * var(--jm-ui-scale))",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {multiDayNotice}
        </div>
      )}

      {(view === "empty" || desktopWriting) && saveError && (
        <div
          role="alert"
          style={{
            margin: "0 24px 12px",
            padding: 12,
            border: "1px solid var(--color-line)",
            borderRadius: 12,
            background: "var(--color-surface)",
            color: "var(--color-danger)",
            fontSize: "calc(13px * var(--jm-ui-scale))",
          }}
        >
          {saveError}
        </div>
      )}

      {view === "empty" && !desktopWriting && (
        <EmptyState
          writeFirst={!canVoice}
          onStartRecording={handleStartRecording}
          onWriteManually={handleWriteManually}
        />
      )}

      {desktopWriting && (
        <DesktopEditor
          key={editorKey}
          targetDate={todayISO()}
          initialText={draftInitial}
          notice={draftNotice}
          aiAvailable={aiAvailable}
          saving={false}
          onCancel={entry ? () => setView("filled") : null}
          onSaveOnly={handleDesktopSaveOnly}
          onSaveAI={handleDesktopSaveAI}
          onWords={setEdWords}
          onDraftSaved={setEdSavedAt}
        />
      )}

      {desktopWriting && (
        <RailToday
          metrics={entry?.metrics ?? null}
          goals={goalsForView}
          people={entry?.people ?? []}
          onMetricChange={handleMetricChange}
          onGoalToggle={handleGoalToggle}
        />
      )}

      {view === "filled" && (
        <FilledView
          headline={entry?.headline ?? null}
          snippet={entry?.snippet ?? null}
          areas={entry?.areas ?? []}
          metrics={entry?.metrics ?? null}
          people={liste.people}
          places={liste.places}
          onTogli={(kind, nome) => {
            void liste.togli(kind, nome);
            setTolte((p) => [...p.filter((x) => x.nome !== nome), { kind, nome }]);
          }}
          tolte={tolte}
          onRimetti={(kind, nome) => {
            void liste.rimetti(kind, nome);
            setTolte((p) => p.filter((x) => x.nome !== nome));
          }}
          goals={goalsForView}
          editHeadline={
            // Solo a giornata salvata e con l'AI: senza AI il titolo non
            // esiste proprio (la prima riga del testo fa da titolo), e non
            // c'e niente da riscrivere.
            entry && canAI
              ? {
                  dateISO: entry.entryDate,
                  mode,
                  locked: entry.headlineLocked === true,
                  onSaved: (e) => setEntry(e),
                  onError: setSaveError,
                }
              : null
          }
          onMetricChange={handleMetricChange}
          onGoalToggle={handleGoalToggle}
          freeProse={
            !canAI && entry
              ? {
                  transcript: entry.transcript,
                  createdAt: entry.createdAt,
                  spoken: entry.durationSeconds > 0,
                }
              : null
          }
          onSeePremium={() => openPremiumWall("aiSummary")}
        />
      )}

      {view === "filled" && <div className="flex-1" />}

      <TabBar active="today" />

      {view === "recording" && (
        <RecordingOverlay
          defaultDate={todayISO()}
          mode={mode}
          onStop={handleStop}
          onCancel={handleCancel}
          onWriteManually={() => setView("manual")}
        />
      )}

      {view === "manual" && !isDesktop && (
        <ManualWrite
          key={editorKey}
          targetDate={todayISO()}
          initialValue={draftInitial}
          notice={draftNotice}
          onContinue={handleManualContinue}
          onCancel={() => setView(entry ? "filled" : "empty")}
        />
      )}

      {view === "review" && pending && (
        <ReviewScreen
          initialTranscript={pending.transcript}
          durationSeconds={pending.durationSeconds}
          targetDate={pending.targetDate}
          onConfirm={handleConfirmReview}
          onCancel={handleCancelReview}
        />
      )}

      {view === "chiarimenti" && chiarimenti && (
        <ChiarimentiScreen
          domande={chiarimenti.domande}
          onRisposta={(r) => {
            void applicaUnaRisposta(r);
          }}
          onDone={(interrotto) => {
            if (interrotto) metteInPausa();
            void finishChiarimenti();
          }}
        />
      )}

      {view === "people" && peopleData && (
        <PeopleReview
          existing={peopleData.existing}
          suggested={peopleData.suggested}
          onConfirm={finishPeople}
          onSkip={(existingPeople) => {
            // "Non ora" vale per sempre su quei nomi: la giornata li ha
            // gia, e chiederlo di nuovo a ogni riga sarebbe assillante.
            declinePeople(peopleData.suggested);
            void finishPeople(existingPeople, []);
          }}
          saving={peopleSaving}
        />
      )}

      {view === "no-capture" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "color-mix(in oklab, var(--color-bg) 92%, transparent)", backdropFilter: "blur(8px)" }}
        >
          <div style={{ maxWidth: 320, padding: "0 28px", textAlign: "center" }}>
            <div
              style={{
                fontSize: "calc(11px * var(--jm-ui-scale))",
                fontWeight: 650,
                color: "var(--color-danger)",
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {t("niente catturato")}
            </div>
            <h2
              style={{
                fontSize: "calc(22px * var(--jm-ui-scale))",
                fontWeight: 650,
                color: "var(--color-ink)",
                lineHeight: 1.2,
                letterSpacing: "-0.015em",
                marginBottom: 12,
              }}
            >
              {t("Non ho sentito nulla.")}
            </h2>
            <p
              style={{
                fontSize: "calc(14px * var(--jm-ui-scale))",
                color: "var(--color-ink-muted)",
                lineHeight: 1.55,
                marginBottom: 26,
              }}
            >
              {t(
                "Forse il microfono era spento o c'era troppo rumore. Riprova da un posto tranquillo.",
              )}
            </p>
            <div className="flex flex-col" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setPending(null);
                  setView("recording");
                }}
              >
                {t("Riprova")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setPending(null);
                  setView(entry ? "filled" : "empty");
                }}
              >
                {t("Esci")}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "processing" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "color-mix(in oklab, var(--color-bg) 85%, transparent)", backdropFilter: "blur(8px)" }}
        >
          <div className="jm-spinner" aria-hidden="true" />
          <div
            style={{
              marginTop: 28,
              fontSize: "calc(11px * var(--jm-ui-scale))",
              fontWeight: 600,
              color: "var(--color-ink-faint)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          >
            {t("elaborazione")}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: "calc(14px * var(--jm-ui-scale))",
              color: "var(--color-ink-muted)",
              maxWidth: 280,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {t("sto leggendo quello che hai detto e tiro fuori il succo")}
          </div>
        </div>
      )}

      {editorOpen && entry && (
        <TranscriptEditor
          initialTranscript={entry.transcript}
          onSave={handleEditorSave}
          onCancel={() => setEditorOpen(false)}
          onDelete={handleEditorDelete}
        />
      )}
    </main>
  );
}

/**
 * "salvato ora" / "salvato 2 min fa" nell'header desktop (SPEC-v2 §6).
 * Riceve il timestamp SOLO di una scrittura riuscita: se l'autosave
 * fallisce, questo componente non viene proprio montato — l'indicatore
 * non mente mai. Si aggiorna ogni 30 secondi.
 */
function SavedAgo({ ts }: { ts: number }) {
  // Montato con key={ts}: appena salvato e sempre "salvato ora", poi
  // l'intervallo aggiorna l'eta. Niente Date.now() in render.
  const [label, setLabel] = useState<string>("salvato ora");
  useEffect(() => {
    const id = window.setInterval(() => {
      const mins = Math.floor((Date.now() - ts) / 60_000);
      setLabel(
        mins < 1 ? "salvato ora" : `salvato ${formatNumber(mins)} min fa`,
      );
    }, 30_000);
    return () => window.clearInterval(id);
  }, [ts]);
  return <> . {label}</>;
}
