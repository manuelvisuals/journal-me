"use client";

import { MetricCards } from "@/components/today/metric-cards";
import { GoalDots } from "@/components/today/goal-dots";
import type { AreaSummary, EntryMetrics, GoalDot } from "@/lib/types";

type Props = {
  headline?: string | null;
  snippet?: string | null;
  areas?: AreaSummary[];
  metrics: EntryMetrics | null;
  goals: GoalDot[];
  onMetricChange: (patch: Partial<EntryMetrics>) => void;
  onGoalToggle: (label: string) => void;
};

const FAKE_AREAS: AreaSummary[] = [
  {
    label: "Lavoro",
    text: "Deck per Marco chiuso a meta pomeriggio. Call Sara spostata a giovedi.",
  },
  {
    label: "Relazioni",
    text: "Discussione con Giulia sul weekend. Riappacificato a cena.",
  },
  {
    label: "Corpo",
    text: "8 km al tramonto, fiato buono. Cena leggera.",
  },
];

const FAKE_HEADLINE = "Giornata di transizione: lavoro avanza, umore vacilla";
const FAKE_SNIPPET =
  "Deck Marco chiuso. Lite con Giulia. Corsa al tramonto rimette in pari.";

export function FilledView({
  headline,
  snippet,
  areas,
  metrics,
  goals,
  onMetricChange,
  onGoalToggle,
}: Props) {
  const displayHeadline = headline ?? FAKE_HEADLINE;
  const displaySnippet = snippet ?? FAKE_SNIPPET;
  const displayAreas =
    areas && areas.length > 0 ? areas : FAKE_AREAS;

  return (
    <div className="flex flex-1 flex-col" style={{ padding: "0 24px" }}>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 650,
          lineHeight: 1.15,
          letterSpacing: "-0.025em",
          color: "var(--color-ink)",
          margin: "4px 0 10px",
        }}
      >
        {displayHeadline}
      </h1>
      <p
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: "var(--color-ink-muted)",
          lineHeight: 1.55,
          marginBottom: 18,
        }}
      >
        {displaySnippet}
      </p>

      <Separator />

      {displayAreas.map((area) => (
        <div key={area.label} style={{ padding: "14px 0" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 650,
              color: "var(--color-accent)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {area.label}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-ink)",
              lineHeight: 1.55,
            }}
          >
            {area.text}
          </div>
        </div>
      ))}

      <Separator />

      <MetricCards metrics={metrics} onChange={onMetricChange} />
      <GoalDots goals={goals} onToggle={onGoalToggle} />
    </div>
  );
}

function Separator() {
  return (
    <div
      style={{
        height: 1,
        background: "var(--color-line)",
        margin: "4px 0",
      }}
    />
  );
}
