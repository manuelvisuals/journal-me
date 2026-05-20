"use client";

import { useEffect, useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { RecapDetail } from "@/components/recap/recap-detail";
import {
  generateAndSaveRecap,
  loadRecaps,
  monthBoundaries,
} from "@/lib/data/recaps";
import type { DataMode } from "@/lib/data/entries";
import type { Recap, RecapPeriod } from "@/lib/types";

type Props = {
  mode: DataMode;
  initialRecaps: Recap[];
};

const PERIODS: { key: RecapPeriod; label: string }[] = [
  { key: "month", label: "Mensili" },
  { key: "semester", label: "Semestrali" },
  { key: "year", label: "Annuali" },
];

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export function RecapClient({ mode, initialRecaps }: Props) {
  const [recaps, setRecaps] = useState<Recap[]>(initialRecaps);
  const [period, setPeriod] = useState<RecapPeriod>("month");
  const [selected, setSelected] = useState<Recap | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // For demo mode hydrate from localStorage on mount.
  useEffect(() => {
    if (mode !== "demo") return;
    let cancelled = false;
    loadRecaps("demo").then((rs) => {
      if (!cancelled && rs.length > 0) setRecaps(rs);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const filtered = recaps.filter((r) => r.periodType === period);

  // Suggest "generate previous month" CTA: takes the most recent COMPLETED
  // month (i.e. last month) and proposes generation if not already there.
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const suggestedYear = lastMonth.getFullYear();
  const suggestedMonth = lastMonth.getMonth() + 1;
  const suggestedStart = `${suggestedYear}-${String(suggestedMonth).padStart(2, "0")}-01`;
  const alreadyGenerated = filtered.some(
    (r) => r.periodStart === suggestedStart,
  );
  const showSuggestion = period === "month" && !alreadyGenerated;
  const suggestedLabel = `${MONTH_NAMES_IT[suggestedMonth - 1]} ${suggestedYear}`;

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { start, end } = monthBoundaries(suggestedYear, suggestedMonth);
      const r = await generateAndSaveRecap(mode, "month", start, end);
      setRecaps((prev) => [
        r,
        ...prev.filter(
          (x) =>
            !(x.periodType === r.periodType && x.periodStart === r.periodStart),
        ),
      ]);
      setSelected(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di generazione");
    } finally {
      setGenerating(false);
    }
  };

  if (selected) {
    return (
      <RecapDetail
        mode={mode}
        recap={selected}
        onBack={() => setSelected(null)}
        onUpdated={(r) => {
          setSelected(r);
          setRecaps((prev) => prev.map((x) => (x.id === r.id ? r : x)));
        }}
      />
    );
  }

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <header className="jm-rec-head">
        <h1 className="jm-rec-h">Recap</h1>
        <div className="jm-period-seg" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              className={period === p.key ? "seg on" : "seg"}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="jm-rec-list">
        {filtered.length === 0 && !showSuggestion ? (
          <EmptyState />
        ) : (
          <>
            {filtered.map((r) => (
              <RecapCard
                key={r.id}
                recap={r}
                onClick={() => setSelected(r)}
              />
            ))}

            {showSuggestion && (
              <SuggestionCard
                label={suggestedLabel}
                generating={generating}
                error={error}
                onClick={handleGenerate}
              />
            )}
          </>
        )}
      </div>

      <TabBar active="recap" />
    </main>
  );
}

function RecapCard({ recap, onClick }: { recap: Recap; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="jm-rec-card">
      <div className="when">{periodLabel(recap)}</div>
      <div className="t">{recap.title}</div>
      <div className="s">{recap.snippet}</div>
    </button>
  );
}

function SuggestionCard({
  label,
  generating,
  error,
  onClick,
}: {
  label: string;
  generating: boolean;
  error: string | null;
  onClick: () => void;
}) {
  return (
    <div className="jm-rec-suggest">
      <div className="title">Genera il recap di {label}</div>
      <div className="hint">
        Lo scrittore intimista rilegge tutte le giornate del mese e ne fa una
        prosa narrativa di 300-450 parole.
      </div>
      {error && <div className="err">{error}</div>}
      <button
        type="button"
        className="jm-gen-btn"
        onClick={onClick}
        disabled={generating}
      >
        {generating ? "Sto leggendo le tue giornate..." : `Genera ${label}`}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="jm-rec-empty">
      <div className="em-h">Nessun recap ancora</div>
      <div className="em-p">
        Servono almeno alcune giornate raccontate per generarne uno.
      </div>
    </div>
  );
}

function periodLabel(r: Recap): string {
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
