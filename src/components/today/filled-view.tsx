"use client";

import { MetricCards } from "@/components/today/metric-cards";
import { GoalDots } from "@/components/today/goal-dots";
import { RailToday } from "@/components/today/rail-today";
import type { AreaSummary, EntryMetrics, GoalDot } from "@/lib/types";

type Props = {
  headline?: string | null;
  snippet?: string | null;
  areas?: AreaSummary[];
  metrics: EntryMetrics | null;
  goals: GoalDot[];
  people?: string[];
  onMetricChange: (patch: Partial<EntryMetrics>) => void;
  onGoalToggle: (label: string) => void;
};

export function FilledView({
  headline,
  snippet,
  areas,
  metrics,
  goals,
  people,
  onMetricChange,
  onGoalToggle,
}: Props) {
  const hasHeadline = !!headline && headline.trim().length > 0;
  const hasSnippet = !!snippet && snippet.trim().length > 0;
  const realAreas = areas?.filter((a) => a.text.trim().length > 0) ?? [];
  const peopleList = (people ?? []).filter((p) => p.trim().length > 0);

  return (
    <div className="flex flex-1 flex-col" style={{ padding: "0 24px" }}>
      {/* Stili in classi jm-fv-*: sotto lg replicano ESATTAMENTE i valori
          inline storici; da lg il mockup desktop-v1 §03 (headline 27px,
          snippet serif corsivo, aree su due colonne a card). */}
      {hasHeadline ? (
        <h1 className="jm-fv-h">{headline}</h1>
      ) : (
        <h1 className="jm-fv-h placeholder">
          giornata raccontata, l&apos;AI non ha ancora generato un titolo
        </h1>
      )}

      {hasSnippet && <p className="jm-fv-sn">{snippet}</p>}

      <Separator />

      {realAreas.length > 0 ? (
        <div className="jm-fv-areas">
          {realAreas.map((area) => (
            <div key={area.label} className="jm-fv-area">
              <div className="l">{area.label}</div>
              <div className="x">{area.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="jm-fv-noareas">aree macro non ancora estratte</div>
      )}

      {/* Sotto lg: persone, metriche e obiettivi restano nella colonna, come
          sempre. Da lg in su la stessa roba vive nella rail destra (mockup
          desktop-v1 §01/§03) e qui si spegne. */}
      <div className="lg:hidden">
        {peopleList.length > 0 && (
          <div style={{ padding: "14px 0" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 650,
                color: "var(--color-accent)",
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Social
            </div>
            <div className="jm-pill-row">
              {peopleList.map((name) => (
                <span key={name} className="jm-person-pill">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-ink-faint)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="12"
                    height="12"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <MetricCards metrics={metrics} onChange={onMetricChange} />
        <GoalDots goals={goals} onToggle={onGoalToggle} />
      </div>

      <RailToday
        metrics={metrics}
        goals={goals}
        people={peopleList}
        onMetricChange={onMetricChange}
        onGoalToggle={onGoalToggle}
      />
    </div>
  );
}

function Separator() {
  return <div className="jm-fv-sep" />;
}
