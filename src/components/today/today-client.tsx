"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { EmptyState } from "@/components/today/empty-state";
import { RecordingOverlay } from "@/components/today/recording-overlay";
import { FilledView } from "@/components/today/filled-view";
import { TranscriptEditor } from "@/components/today/transcript-editor";
import { ReviewScreen } from "@/components/today/review-screen";
import { formatDayHeader, todayISO } from "@/lib/format";
import {
  deleteEntry,
  saveRecording,
  toggleGoal,
  updateEntryTranscript,
  updateMetric,
  type DataMode,
} from "@/lib/data/entries";
import type { Entry, EntryMetrics } from "@/lib/types";

type View =
  | "empty"
  | "recording"
  | "no-capture"
  | "review"
  | "processing"
  | "filled";

type PendingRecording = {
  transcript: string;
  durationSeconds: number;
  targetDate: string;
};

type Props = {
  mode: DataMode;
  initialEntry: Entry | null;
  /** If true, the recording overlay opens immediately on mount (?record=1). */
  autoRecord?: boolean;
};

export function TodayClient({ mode, initialEntry, autoRecord = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [entry, setEntry] = useState<Entry | null>(initialEntry);
  const [view, setView] = useState<View>(
    autoRecord ? "recording" : initialEntry ? "filled" : "empty",
  );

  // Watch for ?record=1 changes coming from clicking the mic in the tab bar
  // while we're already on /. Without this the tab-bar mic looks dummy.
  // Defer the setState via queueMicrotask so React 19's
  // react-hooks/set-state-in-effect rule is satisfied.
  useEffect(() => {
    if (searchParams.get("record") !== "1") return;
    queueMicrotask(() => {
      setView((current) => (current === "recording" ? current : "recording"));
      router.replace("/", { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingRecording | null>(null);

  // Day header is computed at render time. We pass suppressHydrationWarning
  // on the span so SSR/CSR mismatch (server clock vs client clock) is fine.
  const dayHeader = formatDayHeader(new Date());

  // initialEntry is always populated by the server now (everything lives in
  // Supabase). Keeping a no-op effect placeholder for future hydration needs.

  const handleStartRecording = () => {
    setSaveError(null);
    setSavedDates([]);
    setView("recording");
  };

  // Stop recording -> step into the review screen so the user can
  // correct typos / proper names before the AI processes the transcript.
  const handleStop = (
    transcript: string,
    durationSeconds: number,
    targetDate: string,
  ) => {
    if (!transcript.trim()) {
      // Nothing was captured — surface a recoverable dialog instead of
      // silently dropping the recording (Manuel feedback).
      setPending({ transcript: "", durationSeconds, targetDate });
      setView("no-capture");
      return;
    }
    setPending({ transcript, durationSeconds, targetDate });
    setView("review");
  };

  // User confirmed the (possibly corrected) transcript — now run AI.
  const handleConfirmReview = async (finalTranscript: string) => {
    if (!pending) return;
    setView("processing");
    try {
      const saved = await saveRecording(mode, {
        transcript: finalTranscript,
        durationSeconds: pending.durationSeconds,
        defaultDate: pending.targetDate,
      });
      const today = todayISO();
      const todayEntry = saved.find((e) => e.entryDate === today);
      if (todayEntry) setEntry(todayEntry);
      setSavedDates(saved.map((e) => e.entryDate));
      setPending(null);
      setView(todayEntry || entry ? "filled" : "empty");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore nel salvataggio");
      setPending(null);
      setView("empty");
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
      // If this was a brand-new metric save on an empty day, jump to filled.
      if (view === "empty") setView("filled");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore nel salvataggio");
    }
  };

  const handleGoalToggle = async (label: string) => {
    const dateISO = entry?.entryDate ?? todayISO();
    try {
      const updated = await toggleGoal(mode, dateISO, label);
      setEntry(updated);
      if (view === "empty") setView("filled");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore nel salvataggio");
    }
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
      setSaveError(err instanceof Error ? err.message : "Errore eliminazione");
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
      setSaveError(err instanceof Error ? err.message : "Errore nel salvataggio");
      setView(entry ? "filled" : "empty");
    }
  };

  const multiDayNotice =
    savedDates.length > 1
      ? `Salvato su ${savedDates.length} giorni`
      : null;

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      {/* Day header */}
      <header
        className="flex items-baseline justify-between"
        style={{ padding: "26px 24px 6px" }}
      >
        <span
          suppressHydrationWarning
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ink-faint)",
            letterSpacing: "0.20em",
            textTransform: "uppercase",
          }}
        >
          {dayHeader}
        </span>
        {view === "filled" && (
          <div className="flex items-center" style={{ gap: 14 }}>
            <button
              type="button"
              onClick={() => entry && setEditorOpen(true)}
              disabled={!entry}
              style={{
                fontSize: 12,
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
              originale &#8599;
            </button>
            <button
              type="button"
              onClick={handleStartRecording}
              aria-label="Registra di nuovo"
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
            <Link
              href="/settings"
              aria-label="Impostazioni"
              className="jm-settings-btn"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        )}
      </header>

      {/* Soft notice after a multi-day save */}
      {multiDayNotice && view === "filled" && (
        <div
          style={{
            margin: "0 24px 8px",
            padding: "8px 12px",
            border: "1px solid rgba(168,201,176,0.30)",
            borderRadius: 10,
            background: "rgba(168,201,176,0.06)",
            color: "var(--color-success)",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {multiDayNotice}
        </div>
      )}

      {/* Body */}
      {view === "empty" && (
        <>
          {saveError && (
            <div
              role="alert"
              style={{
                margin: "0 24px 12px",
                padding: 12,
                border: "1px solid var(--color-line)",
                borderRadius: 12,
                background: "var(--color-surface)",
                color: "var(--color-danger)",
                fontSize: 13,
              }}
            >
              {saveError}
            </div>
          )}
          <EmptyState onStartRecording={handleStartRecording} />
        </>
      )}

      {view === "filled" && (
        <FilledView
          headline={entry?.headline ?? null}
          snippet={entry?.snippet ?? null}
          areas={entry?.areas ?? []}
          metrics={entry?.metrics ?? null}
          goals={
            entry?.goals && entry.goals.length > 0
              ? entry.goals
              : [
                  { id: "scopato", label: "scopato", on: false },
                  { id: "no alcol", label: "no alcol", on: false },
                  { id: "no junkfood", label: "no junkfood", on: false },
                  { id: "no sbirciato ex", label: "no sbirciato ex", on: false },
                  { id: "camminato", label: "camminato", on: false },
                  { id: "visto sunset", label: "visto sunset", on: false },
                ]
          }
          onMetricChange={handleMetricChange}
          onGoalToggle={handleGoalToggle}
        />
      )}

      {/* Spacer pushes the tab bar down on filled view */}
      {view === "filled" && <div className="flex-1" />}

      <TabBar active="today" />

      {/* Recording overlay sits above everything */}
      {view === "recording" && (
        <RecordingOverlay
          defaultDate={todayISO()}
          mode={mode}
          onStop={handleStop}
          onCancel={handleCancel}
        />
      )}

      {/* Review screen after stop, before AI processing */}
      {view === "review" && pending && (
        <ReviewScreen
          initialTranscript={pending.transcript}
          durationSeconds={pending.durationSeconds}
          targetDate={pending.targetDate}
          onConfirm={handleConfirmReview}
          onCancel={handleCancelReview}
        />
      )}

      {/* No-capture: stop was tapped but the transcript was empty */}
      {view === "no-capture" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(10,5,7,0.92)", backdropFilter: "blur(8px)" }}
        >
          <div
            style={{
              maxWidth: 320,
              padding: "0 28px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 650,
                color: "var(--color-danger)",
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              niente catturato
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 650,
                color: "var(--color-ink)",
                lineHeight: 1.2,
                letterSpacing: "-0.015em",
                marginBottom: 12,
              }}
            >
              Non ho sentito nulla.
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-ink-muted)",
                lineHeight: 1.55,
                marginBottom: 26,
              }}
            >
              Forse il microfono era spento o c&apos;era troppo rumore. Riprova
              da un posto tranquillo.
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
                Riprova
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setPending(null);
                  setView(entry ? "filled" : "empty");
                }}
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing overlay (AI summarization in progress) */}
      {view === "processing" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(10,5,7,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div className="jm-spinner" aria-hidden="true" />
          <div
            style={{
              marginTop: 28,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-ink-faint)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          >
            elaborazione
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "var(--color-ink-muted)",
              maxWidth: 280,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            sto leggendo quello che hai detto e tiro fuori il succo
          </div>
        </div>
      )}

      {/* Transcript editor modal */}
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
