"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { FilledView } from "@/modules/oggi/components/filled-view";
import { TranscriptEditor } from "@/modules/oggi/components/transcript-editor";
import { AddToDay } from "@/modules/oggi/components/add-to-day";
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
import {
  compactDayDate,
  parseISODate,
  relativeDayLabel,
  todayISO,
} from "@/lib/format";
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
export function DayClient({ mode, date, initialEntry }: Props) {
  const t = useT();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(initialEntry);
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

  const targetDateObj = parseISODate(date);
  const todayObj = parseISODate(todayISO());
  const headerLabel = `${relativeDayLabel(targetDateObj, todayObj)} . ${compactDayDate(targetDateObj)}`;

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
  const [tolte, setTolte] = useState<{ kind: FactKind; nome: string }[]>([]);

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
      router.push("/mese");
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
      <header className="jm-day-head">
        <button
          type="button"
          onClick={() => router.push("/mese")}
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
        <div className="jm-day-head-label" suppressHydrationWarning>
          {headerLabel}
        </div>
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

      {entry ? (
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
        /* Giornata vuota: il vicolo cieco diventa un'azione. La data resta
           questa, non diventa oggi — ed e la cosa che il testo deve dire,
           perche e l'unico dubbio vero di chi sta per scrivere. */
        <div className="jm-day-empty-wrap">
          <div className="jm-day-empty-h">
            {t("Non hai raccontato questo giorno")}
          </div>
          <div className="jm-day-empty-p">
            {t("Puoi farlo adesso: la data resta quella, non diventa oggi.")}
          </div>
          <AddToDay
            mode={mode}
            date={date}
            variant="empty"
            onSaved={(e) => setEntry(e)}
            onError={setSaveError}
          />
        </div>
      )}

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
