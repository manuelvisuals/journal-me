"use client";

import type { GoalDot } from "@/lib/types";

type Props = {
  goals: GoalDot[];
  onToggle: (label: string) => void;
};

export function GoalDots({ goals, onToggle }: Props) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ gap: 9, padding: "14px 0 6px" }}
    >
      {goals.map((g) => (
        <button
          key={g.id ?? g.label}
          type="button"
          aria-label={`${g.on ? "Disattiva" : "Attiva"} ${g.label}`}
          title={g.label}
          onClick={() => onToggle(g.label)}
          className={g.on ? "jm-goal-dot on" : "jm-goal-dot"}
        />
      ))}
    </div>
  );
}
