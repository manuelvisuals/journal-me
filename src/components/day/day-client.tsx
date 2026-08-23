"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { FilledView } from "@/components/today/filled-view";
import { TranscriptEditor } from "@/components/today/transcript-editor";
import { AddToDay } from "@/components/day/add-to-day";
import { useOptimisticGoals } from "@/lib/use-optimistic-goals";
import { usePlaces } from "@/lib/use-places";
import {
  compactDayDate,
  parseISODate,
  relativeDayLabel,
  todayISO,
} from "@/lib/format";
import {
  deleteEntry,
  toggleGoal,
  updateEntryTranscript,
  updateMetric,
  type DataMode,
} from "@/lib/data/entries";
import type { Entry, EntryMetrics } from "@/lib/types";
import { useT } from "@/lib/i18n";
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
  const places = usePlaces(mode, date, entry?.transcript ?? null);

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

  const handleTranscriptSave = async (newTranscript: string) => {
    setEditorOpen(false);
    // Rigenera titolo, sintesi e aree passando dall'AI: sono secondi, e
    // senza avviso sembra che il tasto non abbia fatto niente.
    toast.loading(t("Salvo le modifiche..."));
    try {
      const updated = await updateEntryTranscript(mode, date, newTranscript);
      setEntry(updated);
      toast.ok(t("Salvato"));
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
          people={entry.people}
          places={places}
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
              onSaved={(e) => setEntry(e)}
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
