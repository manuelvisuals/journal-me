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

export function FilledView({
  headline,
  snippet,
  areas,
  metrics,
  goals,
  onMetricChange,
  onGoalToggle,
}: Props) {
  const hasHeadline = !!headline && headline.trim().length > 0;
  const hasSnippet = !!snippet && snippet.trim().length > 0;
  const realAreas = areas?.filter((a) => a.text.trim().length > 0) ?? [];

  return (
    <div className="flex flex-1 flex-col" style={{ padding: "0 24px" }}>
      {hasHeadline ? (
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
          {headline}
        </h1>
      ) : (
        <h1
          style={{
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.2,
            color: "var(--color-ink-faint)",
            fontStyle: "italic",
            margin: "4px 0 10px",
          }}
        >
          giornata raccontata, l&apos;AI non ha ancora generato un titolo
        </h1>
      )}

      {hasSnippet && (
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "var(--color-ink-muted)",
            lineHeight: 1.55,
            marginBottom: 18,
          }}
        >
          {snippet}
        </p>
      )}

      <Separator />

      {realAreas.length > 0 ? (
        realAreas.map((area) => (
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
        ))
      ) : (
        <div
          style={{
            padding: "20px 0",
            fontSize: 12,
            color: "var(--color-ink-faint)",
            fontStyle: "italic",
            textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          aree macro non ancora estratte
        </div>
      )}

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
