"use client";

/**
 * Il contenuto della rail destra di Oggi (mockup desktop-v1 §01/§03):
 * La giornata (metriche), Obiettivi, Persone. E lo stesso sia mentre si
 * scrive sia a giornata raccontata — per questo vive qui e non dentro
 * FilledView: lo montano entrambi gli stati, mai insieme.
 */

import { MetricCards } from "@/components/today/metric-cards";
import { RailRight } from "@/components/desktop/rail-right";
import type { EntryMetrics, GoalDot } from "@/lib/types";

type Props = {
  metrics: EntryMetrics | null;
  goals: GoalDot[];
  people: string[];
  onMetricChange: (patch: Partial<EntryMetrics>) => void;
  onGoalToggle: (label: string) => void;
};

export function RailToday({
  metrics,
  goals,
  people,
  onMetricChange,
  onGoalToggle,
}: Props) {
  const peopleList = people.filter((p) => p.trim().length > 0);

  return (
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
  );
}
