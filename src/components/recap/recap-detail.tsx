"use client";

import { TabBar } from "@/components/ui/tab-bar";
import type { Recap } from "@/lib/types";

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

type Props = {
  recap: Recap;
  onBack: () => void;
};

export function RecapDetail({ recap, onBack }: Props) {
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
      </header>

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

      <TabBar active="recap" />
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
