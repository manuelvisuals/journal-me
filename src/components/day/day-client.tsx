"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { FilledView } from "@/components/today/filled-view";
import { TranscriptEditor } from "@/components/today/transcript-editor";
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

type Props = {
  mode: DataMode;
  date: string; // YYYY-MM-DD
  initialEntry: Entry | null;
};

/**
 * Detail view for an arbitrary past day. Reached from Mese by tapping a day
 * row. Reuses all of Today's edit affordances (FilledView, transcript editor,
 * metric upsert, goal toggle, delete) but locked to a fixed date and without
 * the recording entry-point — to re-record, go back to Today.
 */
export function DayClient({ mode, date, initialEntry }: Props) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(initialEntry);
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
      setSaveError(err instanceof Error ? err.message : "Errore");
    }
  };

  const handleGoalToggle = async (label: string) => {
    try {
      const updated = await toggleGoal(mode, date, label);
      setEntry(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore");
    }
  };

  const handleTranscriptSave = async (newTranscript: string) => {
    setEditorOpen(false);
    try {
      const updated = await updateEntryTranscript(mode, date, newTranscript);
      setEntry(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore");
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm("Eliminare questa giornata? Non puoi annullare.")) return;
    setDeleting(true);
    try {
      await deleteEntry(mode, date);
      router.push("/mese");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore");
      setDeleting(false);
    }
  };

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] lg:max-w-[860px] flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <header className="jm-day-head">
        <button
          type="button"
          onClick={() => router.push("/mese")}
          aria-label="Indietro"
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
              originale &#8599;
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Elimina giornata"
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
            fontSize: 12,
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
          goals={entry.goals}
          people={entry.people}
          onMetricChange={handleMetricChange}
          onGoalToggle={handleGoalToggle}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 32px",
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                color: "var(--color-ink-muted)",
                marginBottom: 6,
              }}
            >
              Nessuna giornata registrata
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-ink-faint)",
                lineHeight: 1.5,
              }}
            >
              Vai su Oggi per registrarla. Nel selettore data dell&apos;overlay
              puoi scegliere questo giorno.
            </div>
          </div>
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
