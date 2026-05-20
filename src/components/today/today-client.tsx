"use client";

import { useEffect, useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { EmptyState } from "@/components/today/empty-state";
import { RecordingOverlay } from "@/components/today/recording-overlay";
import { FilledView } from "@/components/today/filled-view";
import { formatDayHeader } from "@/lib/format";
import {
  loadTodayEntry,
  saveTodayEntry,
  type DataMode,
} from "@/lib/data/entries";
import type { Entry } from "@/lib/types";

type View = "empty" | "recording" | "processing" | "filled";

type Props = {
  mode: DataMode;
  initialEntry: Entry | null;
};

export function TodayClient({ mode, initialEntry }: Props) {
  const [entry, setEntry] = useState<Entry | null>(initialEntry);
  const [view, setView] = useState<View>(initialEntry ? "filled" : "empty");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Day header is computed at render time. We pass suppressHydrationWarning
  // on the span so SSR/CSR mismatch (server clock vs client clock) is fine.
  const dayHeader = formatDayHeader(new Date());

  // For demo mode, the server has no localStorage — check it on mount.
  useEffect(() => {
    let cancelled = false;
    if (mode !== "demo" || initialEntry) return;
    loadTodayEntry("demo").then((e) => {
      if (!cancelled && e) {
        setEntry(e);
        setView("filled");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, initialEntry]);

  const handleStartRecording = () => {
    setSaveError(null);
    setView("recording");
  };

  const handleStop = async (transcript: string, durationSeconds: number) => {
    if (!transcript.trim()) {
      // Nothing was captured — bail back to empty.
      setView("empty");
      return;
    }
    setView("processing");
    try {
      const saved = await saveTodayEntry(mode, { transcript, durationSeconds });
      setEntry(saved);
      setView("filled");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore nel salvataggio");
      setView("empty");
    }
  };

  const handleCancel = () => {
    setView(entry ? "filled" : "empty");
  };

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
          <span
            style={{
              fontSize: 12,
              color: "var(--color-accent)",
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            originale &#8599;
          </span>
        )}
      </header>

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
        />
      )}

      {/* Spacer pushes the tab bar down on filled view */}
      {view === "filled" && <div className="flex-1" />}

      <TabBar active="today" />

      {/* Recording overlay sits above everything */}
      {view === "recording" && (
        <RecordingOverlay onStop={handleStop} onCancel={handleCancel} />
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
    </main>
  );
}
