"use client";

/**
 * Il contenuto della rail destra di Oggi (mockup desktop-v1 §01/§03 e
 * impostazioni.html §01/§02): La giornata (metriche), Obiettivi, Persone.
 * E lo stesso sia mentre si scrive sia a giornata raccontata — per questo
 * vive qui e non dentro FilledView: lo montano entrambi gli stati, mai
 * insieme.
 *
 * Le metriche usano RailMetrics (una riga per voce) e non MetricCards:
 * quest'ultimo e fatto per i 390px del telefono e nella rail sbordava di
 * 31px appena si apriva l'editor del mood. Vedi rail-metrics.tsx.
 */

import { useRouter } from "next/navigation";
import { RailMetrics } from "@/components/today/rail-metrics";
import { RailRight } from "@/components/desktop/rail-right";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const router = useRouter();
  const peopleList = people.filter((p) => p.trim().length > 0);
  const done = goals.filter((g) => g.on).length;

  return (
    <RailRight>
      <div className="jm-railr-sec">
        <div className="jm-railr-l">{t("La giornata")}</div>
        <RailMetrics metrics={metrics} onChange={onMetricChange} />
      </div>

      {goals.length > 0 && (
        <div className="jm-railr-sec">
          <div className="jm-railr-l">
            {t("Obiettivi")}
            <span className="jm-railr-count">
              {t("{fatti} su {totali}", {
                fatti: formatNumber(done),
                totali: formatNumber(goals.length),
              })}
            </span>
          </div>
          {goals.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`jm-railr-goal${g.on ? " on" : ""}`}
              onClick={() => onGoalToggle(g.label)}
              aria-pressed={g.on}
            >
              <span className="jm-railr-gbox" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="jm-railr-gname">{g.label}</span>
            </button>
          ))}
        </div>
      )}

      {peopleList.length > 0 && (
        <div className="jm-railr-sec">
          <div className="jm-railr-l">{t("Persone")}</div>
          <div className="jm-railr-chips">
            {peopleList.map((name) => (
              <button
                key={name}
                type="button"
                className="jm-railr-chip link"
                onClick={() =>
                  router.push(`/persona?nome=${encodeURIComponent(name)}`)
                }
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </RailRight>
  );
}
