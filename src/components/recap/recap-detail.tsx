"use client";

import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { RecapEditor } from "@/components/recap/recap-editor";
import { updateRecap } from "@/lib/data/recaps";
import type { DataMode } from "@/lib/data/entries";
import type { Recap } from "@/lib/types";

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

type Props = {
  mode: DataMode;
  recap: Recap;
  onBack: () => void;
  onUpdated: (r: Recap) => void;
};

export function RecapDetail({ mode, recap, onBack, onUpdated }: Props) {
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleEditorSave = async (patch: {
    title: string;
    snippet: string;
    body: string;
  }) => {
    setError(null);
    try {
      const updated = await updateRecap(mode, recap.id, patch);
      onUpdated(updated);
      setEditorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di salvataggio");
    }
  };

  const paragraphs = recap.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <header className="jm-det-head">
        <button
          type="button"
          onClick={onBack}
          aria-label="Indietro"
          className="jm-det-back"
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
        <div className="jm-det-meta">{formatLabel(recap)}</div>
        <button
          type="button"
          className="jm-det-edit"
          onClick={() => setEditorOpen(true)}
          aria-label="Modifica recap"
        >
          Modifica
        </button>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            margin: "0 24px",
            padding: 10,
            border: "1px solid var(--color-danger)",
            borderRadius: 10,
            background: "var(--color-surface)",
            color: "var(--color-danger)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div className="jm-det-body">
        <h1 className="jm-det-title">{recap.title}</h1>
        {paragraphs.map((p, i) => {
          // Quote detection: paragraph wrapped entirely in straight quotes.
          const isQuote = /^["'][\s\S]*["']$/.test(p);
          if (isQuote) {
            return (
              <blockquote key={i} className="jm-drop-quote">
                {p.replace(/^["']|["']$/g, "")}
              </blockquote>
            );
          }
          return <p key={i}>{p}</p>;
        })}
      </div>

      <TabBar active="settings" />

      {editorOpen && (
        <RecapEditor
          initialTitle={recap.title}
          initialSnippet={recap.snippet}
          initialBody={recap.body}
          onSave={handleEditorSave}
          onCancel={() => setEditorOpen(false)}
        />
      )}
    </main>
  );
}

function formatLabel(r: Recap): string {
  if (r.periodType === "month") {
    const [y, m] = r.periodStart.split("-").map(Number);
    return `${MONTH_NAMES_IT[m - 1]} ${y}`;
  }
  if (r.periodType === "semester") {
    const [y, m] = r.periodStart.split("-").map(Number);
    return `Semestre ${m <= 6 ? 1 : 2} ${y}`;
  }
  const [y] = r.periodStart.split("-").map(Number);
  return `Anno ${y}`;
}
