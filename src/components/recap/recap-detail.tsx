"use client";

import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { RecapEditor } from "@/components/recap/recap-editor";
import { updateRecap } from "@/lib/data/recaps";
import { useT } from "@/lib/i18n";
import { recapPeriodLabel } from "@/lib/recap-labels";
import type { DataMode } from "@/lib/data/entries";
import type { Recap } from "@/lib/types";

type Props = {
  mode: DataMode;
  recap: Recap;
  onBack: () => void;
  onUpdated: (r: Recap) => void;
};

export function RecapDetail({ mode, recap, onBack, onUpdated }: Props) {
  const t = useT();
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
      setError(err instanceof Error ? err.message : t("Errore di salvataggio"));
    }
  };

  const paragraphs = recap.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <main
      className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
    >
      <header className="jm-det-head">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("Indietro")}
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
        <div className="jm-det-meta">
          {recapPeriodLabel(recap.periodType, recap.periodStart)}
        </div>
        <button
          type="button"
          className="jm-det-edit"
          onClick={() => setEditorOpen(true)}
          aria-label={t("Modifica recap")}
        >
          {t("Modifica")}
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
