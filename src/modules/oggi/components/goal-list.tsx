"use client";

/**
 * Gli obiettivi del giorno sul telefono (mockup
 * design/mockups/obiettivi-mobile.html, variante A, approvata il 21 agosto
 * 2026).
 *
 * Cosa c'era prima: cinque pallini da 14px, tutti uguali, senza nome.
 * Due difetti, e nessuno dei due era estetico.
 *
 *  1. NON DICEVANO QUALE. Per sapere che il terzo pallino era "meditazione"
 *     dovevi ricordartelo. Sul desktop la stessa informazione era gia una
 *     lista con i nomi (RailToday): il telefono era l'unico posto dove
 *     l'app la nascondeva.
 *  2. NON SI PRENDEVANO. Il bersaglio vero era stato allargato a 23x40 con
 *     uno pseudo-elemento, ma restano meno del polpastrello (44px), e due
 *     obiettivi vicini erano a 9px l'uno dall'altro: sbagliare mira non
 *     voleva dire mancare, voleva dire accendere quello sbagliato.
 *
 * Ora ogni obiettivo e una riga da 52px di altezza, larga quanto la
 * colonna: il bersaglio e tutta la riga, non la casella. Le righe sono
 * separate da una linea sottile e non chiuse in un riquadro — cinque
 * obiettivi non devono diventare cinque scatole che pesano piu del diario.
 *
 * In alto quanti ne hai fatti. E l'unica cifra che conta ed e cio che i
 * pallini, a rigore, mostravano gia: solo che per leggerla dovevi contare.
 */

import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { GoalDot } from "@/lib/types";

type Props = {
  goals: GoalDot[];
  onToggle: (label: string) => void;
};

export function GoalList({ goals, onToggle }: Props) {
  const t = useT();
  if (goals.length === 0) return null;
  const done = goals.filter((g) => g.on).length;

  return (
    <section className="jm-goals">
      <div className="jm-goals-head">
        <span className="l">{t("Obiettivi")}</span>
        <span className="c">
          {t("{fatti} su {totali}", {
            fatti: formatNumber(done),
            totali: formatNumber(goals.length),
          })}
        </span>
      </div>
      <div className="jm-goals-list">
        {goals.map((g) => (
          <button
            key={g.id ?? g.label}
            type="button"
            className={g.on ? "jm-goal-row on" : "jm-goal-row"}
            onClick={() => onToggle(g.label)}
            aria-pressed={g.on}
          >
            <span className="jm-goal-box" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="jm-goal-lab">{g.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
