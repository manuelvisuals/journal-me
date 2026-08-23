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

import { RailMetrics } from "@/components/today/rail-metrics";
import { RailRight } from "@/components/desktop/rail-right";
import { PillRow } from "@/components/today/pill-row";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { EntryMetrics, FactKind, GoalDot } from "@/lib/types";

type Props = {
  metrics: EntryMetrics | null;
  goals: GoalDot[];
  people: string[];
  /** I luoghi della giornata, sotto le persone (mockup titolo-riassunto-luoghi §03). */
  places?: string[];
  /** La X: toglie una voce da questa giornata. Vedi src/lib/use-day-lists.ts. */
  onTogli?: (kind: FactKind, nome: string) => void;
  /** Cosa e stato tolto durante questa visita, per poterlo rimettere. */
  tolte?: { kind: FactKind; nome: string }[];
  onRimetti?: (kind: FactKind, nome: string) => void;
  onMetricChange: (patch: Partial<EntryMetrics>) => void;
  onGoalToggle: (label: string) => void;
};

export function RailToday({
  metrics,
  goals,
  people,
  places,
  onTogli,
  tolte = [],
  onRimetti,
  onMetricChange,
  onGoalToggle,
}: Props) {
  const t = useT();
  const peopleList = people.filter((p) => p.trim().length > 0);
  const placeList = (places ?? []).filter((p) => p.trim().length > 0);
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
          <div className="jm-railr-l">{t("Persone incontrate")}</div>
          <PillRow
            nomi={peopleList}
            kind="persona"
            variante="rail"
            cliccabile
            onTogli={(k, n) => onTogli?.(k, n)}
            tolte={tolte.filter((x) => x.kind === "persona").map((x) => x.nome)}
            onRimetti={onRimetti}
          />
        </div>
      )}

      {/* I luoghi non hanno ancora una scheda propria come le persone: per
          ora sono pastiglie da leggere, non da cliccare. Il giorno che la
          scheda esiste, diventano bottoni come sopra. */}
      {placeList.length > 0 && (
        <div className="jm-railr-sec jm-places">
          <div className="jm-railr-l">{t("Luoghi visitati")}</div>
          <PillRow
            nomi={placeList}
            kind="luogo"
            variante="rail"
            onTogli={(k, n) => onTogli?.(k, n)}
            tolte={tolte.filter((x) => x.kind === "luogo").map((x) => x.nome)}
            onRimetti={onRimetti}
          />
        </div>
      )}
    </RailRight>
  );
}
