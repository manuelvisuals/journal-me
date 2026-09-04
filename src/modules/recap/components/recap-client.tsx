"use client";

import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { RecapDetail } from "@/modules/recap/components/recap-detail";
import { openPremiumWall } from "@/modules/abbonamento";
import { useCan } from "@/lib/capabilities";
import { PREMIUM_PRICE_AMOUNT, PREMIUM_PRICE_PERIOD, PREMIUM_PROVA_GIORNI } from "@/lib/pricing";
import { monthBoundaries } from "@/lib/data/recaps";
import { generateAndSaveRecap } from "@/lib/actions/generate-recap";
import { formatMonthTitle } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { recapPeriodLabel } from "@/lib/recap-labels";
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

export function RecapClient({ mode, initialRecaps }: Props) {
  const t = useT();
  const canRecap = useCan("recap");
  const [recaps, setRecaps] = useState<Recap[]>(initialRecaps);
  const [period, setPeriod] = useState<RecapPeriod>("month");
  const [selected, setSelected] = useState<Recap | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // For demo mode hydrate from localStorage on mount.
  // initialRecaps is always populated server-side now.

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
  const suggestedLabel = formatMonthTitle(suggestedYear, suggestedMonth);

  const handleGenerate = async () => {
    if (generating) return;
    // Gratis: il tasto resta, ma apre il muro premium invece di partire
    // (SPEC-v2 §3.3: mai un 402 a sorpresa).
    if (!canRecap) {
      openPremiumWall("recap");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { start, end } = monthBoundaries(suggestedYear, suggestedMonth);
      const r = await generateAndSaveRecap("month", start, end);
      setRecaps((prev) => [
        r,
        ...prev.filter(
          (x) =>
            !(x.periodType === r.periodType && x.periodStart === r.periodStart),
        ),
      ]);
      setSelected(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Errore di generazione"));
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
      className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
    >
      <header className="jm-rec-head">
        {/* Sul telefono il titolo e nella barra in alto (30 agosto 2026,
            mockup pallino-ovunque, strada B). Da lg la barra non c'e e il
            titolo resta dov'era. */}
        <h1 className="jm-rec-h jm-solo-desktop">Recap</h1>
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
              {t(p.label)}
            </button>
          ))}
        </div>
      </header>

      <div className="jm-rec-list">
        {!canRecap && recaps.length === 0 ? (
          <Vetrina onProva={() => openPremiumWall("recap")} />
        ) : filtered.length === 0 && !showSuggestion ? (
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

      <TabBar active="module" />
    </main>
  );
}

function RecapCard({ recap, onClick }: { recap: Recap; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="jm-rec-card">
      <div className="when">
        {recapPeriodLabel(recap.periodType, recap.periodStart)}
      </div>
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
  const t = useT();
  return (
    <div className="jm-rec-suggest">
      <div className="title">
        {t("Genera il recap di {periodo}", { periodo: label })}
      </div>
      <div className="hint">
        {t(
          "Lo scrittore intimista rilegge tutte le giornate del mese e ne fa una prosa narrativa di 300-450 parole.",
        )}
      </div>
      {error && <div className="err">{error}</div>}
      <button
        type="button"
        className="btn-primary jm-gen-btn"
        onClick={onClick}
        disabled={generating}
      >
        {generating
          ? t("Sto leggendo le tue giornate...")
          : t("Genera {periodo}", { periodo: label })}
      </button>
    </div>
  );
}

/**
 * La vetrina del Recap per chi non e premium (mockup premium-senza-password,
 * decisione E1 di Manuel): una pagina che dice cosa fa, con la prova sotto.
 * Chi arriva qui ha gia curiosita: si risponde, non si blocca. Il tasto
 * apre il muro a schede (prezzo e prova li dice Apple).
 */
function Vetrina({ onProva }: { onProva: () => void }) {
  const t = useT();
  return (
    <div className="jm-rec-vetrina">
      <span className="tag">{t("Premium")}</span>
      <h2>{t("Il mese, riletto per te.")}</h2>
      <p>
        {t(
          "Ogni mese l'AI rilegge le tue giornate e scrive cosa e cambiato.",
        )}
      </p>
      <button type="button" className="btn-primary" onClick={onProva}>
        {t("Prova gratis {n} giorni", { n: String(PREMIUM_PROVA_GIORNI) })}
      </button>
      <div className="sotto">
        {t("poi {prezzo} {periodo}, disdici quando vuoi", {
          prezzo: PREMIUM_PRICE_AMOUNT,
          periodo: t(PREMIUM_PRICE_PERIOD),
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="jm-rec-empty">
      <div className="em-h">{t("Nessun recap ancora")}</div>
      <div className="em-p">
        {t("Servono almeno alcune giornate raccontate per generarne uno.")}
      </div>
    </div>
  );
}
