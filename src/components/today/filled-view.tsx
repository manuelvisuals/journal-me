"use client";

import { MetricCards } from "@/components/today/metric-cards";
import { GoalDots } from "@/components/today/goal-dots";
import { RailRight } from "@/components/desktop/rail-right";
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

      <RailRight>
        <div className="jm-railr-sec">
          <div className="jm-railr-l">La giornata</div>
          <MetricCards metrics={metrics} onChange={onMetricChange} />
        </div>
        <div className="jm-railr-sec">
          <div className="jm-railr-l">Obiettivi</div>
          {goals.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`jm-railr-goal${g.on ? " on" : ""}`}
              onClick={() => onGoalToggle(g.label)}
            >
              <span className="jm-railr-gdot" />
              <span className="jm-railr-gname">{g.label}</span>
            </button>
          ))}
        </div>
        {peopleList.length > 0 && (
          <div className="jm-railr-sec">
            <div className="jm-railr-l">Persone</div>
            <div className="jm-railr-chips">
              {peopleList.map((name) => (
                <span key={name} className="jm-railr-chip">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </RailRight>
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
