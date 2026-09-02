"use client";

import { useRouter } from "next/navigation";
import { AppBarAzione } from "@/components/ui/app-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { FilledView } from "@/modules/oggi/components/filled-view";
import { FotoGiorno } from "@/modules/oggi/components/foto-giorno";
import { TranscriptEditor } from "@/modules/oggi/components/transcript-editor";
import { AddToDay } from "@/modules/oggi/components/add-to-day";
import { EmptyState } from "@/modules/oggi/components/empty-state";
import {
  DayNav,
  eFuturo,
  giornoDopo,
  giornoPrima,
} from "@/modules/oggi/components/day-nav";
import { DaySwipe } from "@/modules/oggi/components/day-swipe";
import { useOptimisticGoals } from "@/lib/use-optimistic-goals";
import { useDayLists } from "@/lib/use-day-lists";
import { ChiarimentiScreen } from "@/modules/oggi/components/chiarimenti-screen";
import {
  applicaRisposte,
  chiediChiarimenti,
  metteInPausa,
  type Domanda,
  type Risposta,
} from "@/lib/chiarimenti";
import { todayISO } from "@/lib/format";
import {
  deleteEntry,
  toggleGoal,
  loadEntryForDate,
  updateEntryTranscript,
  updateMetric,
  type DataMode,
} from "@/lib/data/entries";
import type { Entry, EntryMetrics, FactKind } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/capabilities";
import { toast } from "@/components/ui/toast";

type Props = {
  mode: DataMode;
  date: string; // YYYY-MM-DD
  initialEntry: Entry | null;
};

/**
 * La schermata di una giornata qualsiasi, aperta da Mese. Riusa tutto quello
 * che Oggi sa fare (FilledView, editor del transcript, metriche, obiettivi,
 * eliminazione) ma con la data fissa.
 *
 * Dal 20 agosto 2026 ha anche un modo per AGGIUNGERE (mockup
 * testo-e-giorno.html §03): prima non ce l'aveva, e una giornata vuota
 * diceva solo "vai su Oggi" — un vicolo cieco, per giunta su una schermata
 * che ti sei aperto apposta per quel giorno.
 */
export function DayClient({ mode, date: dataIniziale, initialEntry }: Props) {
  const t = useT();
  const router = useRouter();
  /* La data e di STATO, non piu solo una prop: da qui si sfoglia senza
     cambiare pagina (mockup navigazione-giorno.html, 29 agosto 2026).
     Si chiama ancora `date` perche tutto il resto della schermata la usa
     con quel nome: il cambio doveva restare piccolo. */
  const [date, setDate] = useState<string>(dataIniziale);
  const [entry, setEntry] = useState<Entry | null>(initialEntry);
  /* Quante volte il dito ha sbattuto contro il muro del futuro: la
     testata guarda questo numero per far comparire la riga che lo spiega. */
  const [muro, setMuro] = useState<number>(0);
  const [caricando, setCaricando] = useState<boolean>(false);
  /* Le pastiglie tolte a mano durante questa visita: si azzerano a ogni
     cambio di giorno, e per questo la dichiarazione sta qui sopra a chi
     cambia giorno. */
  const [tolte, setTolte] = useState<{ kind: FactKind; nome: string }[]>([]);
  const optimisticGoals = useOptimisticGoals();
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  // Le domande dell'AI. Vivono anche qui e non solo su Oggi: la strada piu
  // battuta per cambiare una giornata e "aggiungi a questa giornata", e se
  // i dubbi si chiedessero solo al primo salvataggio, tutto cio che aggiungi
  // dopo tornerebbe a essere indovinato.
  const [domande, setDomande] = useState<Domanda[] | null>(null);
  // Un soprannome appena chiarito deve vedersi SUBITO, senza ricaricare la
  // pagina. I soprannomi si ricaricano quando cambia la giornata, ma
  // rispondere a una domanda non sempre cambia la giornata: puo scrivere
  // solo l'alias. Questo contatore e l'altro motivo per rileggerli.
  const [aliasRev, setAliasRev] = useState(0);
  const canAI = useCan("aiSummary");
  const canVoice = useCan("voice");
  /* I due tasti dello stato vuoto parlano ad AddToDay coi segnali (stesso
     meccanismo del + della barra): il numero cresce, il foglio si apre. */
  const [scritturaSegnale, setScritturaSegnale] = useState<number>(0);
  const [voceSegnale, setVoceSegnale] = useState<number>(0);
  const [menuSegnale, setMenuSegnale] = useState<number>(0);

  /* =====================================================================
     Sfogliare i giorni senza cambiare pagina.

     Le giornate viste restano in una mappa e i due VICINI si leggono in
     anticipo: senza, ogni scatto del dito mostrerebbe mezzo secondo di
     niente prima del racconto, e sfogliare diventerebbe aspettare.
     ===================================================================== */
  const cache = useRef<Map<string, Entry | null>>(new Map());
  const richiesta = useRef<number>(0);

  useEffect(() => {
    cache.current.set(date, entry);
  }, [date, entry]);

  useEffect(() => {
    let vivo = true;
    const vicini = [giornoPrima(date), giornoDopo(date)].filter(
      (d) => !eFuturo(d) && !cache.current.has(d),
    );
    void (async () => {
      for (const d of vicini) {
        try {
          const e = await loadEntryForDate(mode, d);
          if (!vivo) return;
          cache.current.set(d, e);
        } catch {
          /* Il vicino non e urgente: se non arriva, si legge al momento. */
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [date, mode]);

  /**
   * Il cambio giorno. Tre strade e una regola sola: oltre oggi non si va.
   *   - domani o piu in la -> il muro (la riga che si dissolve)
   *   - oggi               -> "/", che e la casa di oggi (col microfono)
   *   - qualunque altro    -> si resta qui, cambia il contenuto
   */
  const vaiA = useCallback(
    (iso: string) => {
      if (eFuturo(iso)) {
        setMuro((n) => n + 1);
        return;
      }
      if (iso === todayISO()) {
        router.push("/app");
        return;
      }
      const mio = ++richiesta.current;
      setDate(iso);
      setTolte([]);
      setSaveError(null);
      setDomande(null);
      setEditorOpen(false);
      /* L'indirizzo segue il giorno mostrato: se ricarichi sei ancora li.
         replaceState e non push: il tasto indietro deve riportarti da dove
         sei arrivato (Mese, o Oggi), non farti risalire un giorno per volta. */
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/app/giorno?d=${iso}`);
      }
      if (cache.current.has(iso)) {
        setEntry(cache.current.get(iso) ?? null);
        setCaricando(false);
        return;
      }
      setEntry(null);
      setCaricando(true);
      void (async () => {
        try {
          const e = await loadEntryForDate(mode, iso);
          if (richiesta.current !== mio) return;
          cache.current.set(iso, e);
          setEntry(e);
        } catch (err) {
          if (richiesta.current !== mio) return;
          setSaveError(err instanceof Error ? err.message : t("Errore"));
        } finally {
          if (richiesta.current === mio) setCaricando(false);
        }
      })();
    },
    [mode, router, t],
  );

  /* Il giorno dopo questo e gia domani? Allora il dito, da questa parte,
     trova il muro. */
  const muroDopo = eFuturo(giornoDopo(date));

  const handleMetricChange = async (patch: Partial<EntryMetrics>) => {
    try {
      const updated = await updateMetric(mode, date, patch);
      setEntry(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Errore"));
    }
  };

  // La spunta si accende SUBITO e poi si salva: vedi
  // src/lib/use-optimistic-goals.ts.
  const goalsForView = optimisticGoals.view(entry?.goals ?? []);

  // I luoghi arrivano dai fatti, non dall'entry: si ricaricano ogni volta
  // che la giornata viene risalvata (il testo cambia, l'analisi riparte).
  // Persone e luoghi pronti da mostrare: soprannomi applicati e cose tolte a
  // mano gia fuori. Vedi src/lib/use-day-lists.ts.
  const liste = useDayLists(
    mode,
    date,
    entry?.people ?? [],
    `${entry?.transcript ?? ""}|${aliasRev}`,
  );

  const handleGoalToggle = async (label: string) => {
    await optimisticGoals.toggle(goalsForView, label, async () => {
      try {
        const updated = await toggleGoal(mode, date, label);
        setEntry(updated);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : t("Errore"));
      }
    });
  };

  /**
   * Dopo ogni rilettura del testo: cosa non ha capito?
   *
   * Solo se l'AI c'e davvero. Senza, non c'e stata nessuna rilettura e non
   * c'e niente da chiarire: chiedere lo stesso vorrebbe dire una richiesta
   * buttata a ogni salvataggio di ogni utente gratis, e un errore rosso in
   * console che non riguarda nessuno.
   */
  const chiediDopoAnalisi = async (aggiornata: Entry) => {
    if (!canAI) return;
    const q = await chiediChiarimenti(mode, date, aggiornata.transcript, {
      people: aggiornata.people ?? [],
      areas: aggiornata.areas ?? [],
    });
    if (q.length > 0) setDomande(q);
  };

  /** Vedi today-client: ogni risposta si applica alla SUA giornata, subito. */
  const applicaUnaRisposta = async (r: Risposta) => {
    const dataDomanda = r.domanda.entryDate;
    try {
      const suaEntry =
        dataDomanda === date ? entry : await loadEntryForDate(mode, dataDomanda);
      const aggiornata = await applicaRisposte(mode, dataDomanda, suaEntry, [r]);
      if (aggiornata && dataDomanda === date) setEntry(aggiornata);
      setAliasRev((n) => n + 1);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Errore"));
    }
  };

  const finishDomande = () => {
    setDomande(null);
    setAliasRev((n) => n + 1);
  };

  const handleTranscriptSave = async (newTranscript: string) => {
    setEditorOpen(false);
    // Rigenera titolo, sintesi e aree passando dall'AI: sono secondi, e
    // senza avviso sembra che il tasto non abbia fatto niente.
    toast.loading(t("Salvo le modifiche..."));
    try {
      const updated = await updateEntryTranscript(mode, date, newTranscript);
      setEntry(updated);
      toast.ok(t("Salvato"));
      await chiediDopoAnalisi(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Errore");
      setSaveError(msg);
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm(t("Eliminare questa giornata? Non puoi annullare."))) return;
    setDeleting(true);
    toast.loading(t("Elimino la giornata..."));
    try {
      await deleteEntry(mode, date);
      toast.ok(t("Giornata eliminata"));
      router.push("/app/mese");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Errore");
      setSaveError(msg);
      toast.error(msg);
      setDeleting(false);
    }
  };

  if (domande) {
    return (
      <ChiarimentiScreen
        mode={mode}
        domande={domande}
        onRisposta={(r) => {
          void applicaUnaRisposta(r);
        }}
        onDone={(interrotto) => {
          if (interrotto) metteInPausa();
          finishDomande();
        }}
      />
    );
  }

  return (
    <main
      className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
    >
      {/* SUL TELEFONO i comandi vivono nella barra in alto (mockup
          testate-oggi-giornata, approvato da Manuel il 1 settembre 2026
          sera): l'indietro prima del nome, matita e cestino prima del
          pallino. Sotto la barra resta solo la riga del giorno, sul
          metro di Month. La riga qui sotto resta per il DESKTOP, dove
          la barra non esiste. */}
      {/* L'indietro NON sta nella barra (Manuel, 2 settembre 2026,
          notte: "eliminami il tasto indietro davanti a The day"): per
          tornare al Mese c'e il tasto Mese nel dock, sempre visibile. La
          barra tiene solo matita e cestino. */}
      {/* Sul giorno VUOTO la barra tiene un +: apre il foglio di AddToDay
          (foto dal rullino, Memo, scrivi, voce). Senza, un giorno senza
          parole non avrebbe piu una porta per le sue foto (prima la apriva
          il tasto "Racconta il 27", che non esiste piu). */}
      {!entry && !caricando && (
        <AppBarAzione>
          <button
            type="button"
            className="jm-cmd"
            aria-label={t("Aggiungi a questa giornata")}
            onClick={() => setMenuSegnale((n) => n + 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </AppBarAzione>
      )}
      {entry && (
        <AppBarAzione>
          <button
            type="button"
            className="jm-cmd"
            aria-label={t("modifica")}
            onClick={() => setEditorOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="jm-cmd rosso"
            aria-label={t("Elimina giornata")}
            onClick={handleDelete}
            disabled={deleting}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </AppBarAzione>
      )}
      <header className="jm-day-head jm-day-head-col">
        <div className="jm-day-head-riga jm-solo-desktop">
        <button
          type="button"
          onClick={() => router.push("/app/mese")}
          aria-label={t("Indietro")}
          className="jm-day-back"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="16"
            height="16"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {entry && (
          <div className="jm-day-head-actions">
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="jm-day-head-action"
            >
              {t("modifica")} &#8599;
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={t("Elimina giornata")}
              className="jm-day-head-del"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="16"
                height="16"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        )}
        </div>
        <DayNav date={date} onVai={vaiA} muro={muro} />
      </header>

      {saveError && (
        <div
          role="alert"
          style={{
            margin: "0 24px 12px",
            padding: 10,
            background: "var(--color-surface)",
            border: "1px solid var(--color-danger)",
            borderRadius: 10,
            color: "var(--color-danger)",
            fontSize: "calc(12px * var(--jm-ui-scale))",
          }}
        >
          {saveError}
        </div>
      )}

      {/* Da qui in giu si sfoglia col dito: trascini verso destra e arriva
          ieri, che entra da sinistra — dov'e la freccia "<". La testata
          resta ferma e si aggiorna: e lei a dire dove sei finito. */}
      <DaySwipe
        onPrima={() => vaiA(giornoPrima(date))}
        onDopo={() => vaiA(giornoDopo(date))}
        muroDopo={muroDopo}
        onMuro={() => setMuro((n) => n + 1)}
      >
      {caricando ? (
        /* Un attimo di attesa, non una giornata vuota: dire "non hai
           raccontato questo giorno" mentre lo stiamo ancora leggendo
           sarebbe una bugia, e per giunta quella che fa male. */
        <div className="jm-day-attesa">
          <span className="jm-dot-pulse" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      ) : entry ? (
        <FilledView
          headline={entry.headline}
          snippet={entry.snippet}
          areas={entry.areas}
          metrics={entry.metrics}
          goals={goalsForView}
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
          editHeadline={{
            dateISO: date,
            mode,
            locked: entry.headlineLocked === true,
            onSaved: (e) => setEntry(e),
            onError: setSaveError,
          }}
          onMetricChange={handleMetricChange}
          onGoalToggle={handleGoalToggle}
          fotoSlot={<FotoGiorno date={date} />}
          footer={
            <AddToDay
              mode={mode}
              date={date}
              onSaved={(e) => {
                setEntry(e);
                void chiediDopoAnalisi(e);
              }}
              onError={setSaveError}
            />
          }
        />
      ) : (
        /* UNA GIORNATA SOLA (mockup una-giornata-sola.html, approvato il
           2 settembre 2026): la giornata vuota di un giorno passato e LO
           STESSO stato vuoto di Oggi — stessa domanda con la data, gli
           stessi due tasti, le foto del giorno sotto. I tasti aprono
           l'atto (scrittura o ascolto) sul giorno di QUESTA schermata,
           attraverso il foglio di AddToDay, che qui non disegna niente. */
        <>
          <EmptyState
            date={date}
            writeFirst={!canVoice}
            onStartRecording={() => setVoceSegnale((n) => n + 1)}
            onWriteManually={() => setScritturaSegnale((n) => n + 1)}
            fotoSlot={<FotoGiorno date={date} />}
          />
          <AddToDay
            mode={mode}
            date={date}
            variant="muto"
            apriSegnale={menuSegnale}
            apriScritturaSegnale={scritturaSegnale}
            apriVoceSegnale={voceSegnale}
            onSaved={(e) => {
              setEntry(e);
              void chiediDopoAnalisi(e);
            }}
            onError={setSaveError}
          />
        </>
      )}
      </DaySwipe>

      {editorOpen && entry && (
        <TranscriptEditor
          initialTranscript={entry.transcript}
          onSave={handleTranscriptSave}
          onCancel={() => setEditorOpen(false)}
        />
      )}

      <TabBar active="month" />
    </main>
  );
}
