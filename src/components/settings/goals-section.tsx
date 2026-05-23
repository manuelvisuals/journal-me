"use client";

import { useState } from "react";
import { addGoal, removeGoal } from "@/lib/data/goals";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

type Props = {
  mode: DataMode;
  initial: GoalDef[];
};

/**
 * Micro-goal configuration. The goals live in the DB (`goals` table); there is
 * no hardcoded list. Add appends, the X removes. Goals show up as the dots on
 * each day's view.
 */
export function GoalsSection({ mode, initial }: Props) {
  const [goals, setGoals] = useState<GoalDef[]>(initial);
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const t = draft.trim();
    if (!t || busy) return;
    if (goals.some((g) => g.label.toLowerCase() === t.toLowerCase())) {
      setDraft("");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await addGoal(mode, t);
      setGoals((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel salvataggio");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    const prev = goals;
    // Optimistic remove for instant feedback; roll back on failure.
    setGoals((g) => g.filter((x) => x.id !== id));
    setError(null);
    try {
      await removeGoal(mode, id);
    } catch (err) {
      setGoals(prev);
      setError(err instanceof Error ? err.message : "Errore nella rimozione");
    }
  };

  return (
    <section className="jm-set-section">
      <div className="jm-set-section-h">
        Micro-goal {busy && <span style={{ opacity: 0.55 }}>. salvo...</span>}
      </div>
      <div className="jm-set-section-hint">
        Tracker neutri, niente voti. Aggiungi o togli quelli che vuoi. Compaiono
        come <b>dot</b> nella giornata.
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: 10,
            border: "1px solid var(--color-danger)",
            borderRadius: 10,
            background: "rgba(248,113,113,0.08)",
            color: "var(--color-danger)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {goals.length > 0 && (
        <div className="jm-glossary">
          {goals.map((g) => (
            <span key={g.id} className="jm-gloss-tag">
              {g.label}
              <button
                type="button"
                className="x"
                aria-label={`Rimuovi ${g.label}`}
                onClick={() => handleRemove(g.id)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
        className="jm-gloss-input"
      >
        <input
          type="text"
          placeholder="Aggiungi micro-goal..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          type="submit"
          className="add"
          aria-label="Aggiungi"
          disabled={!draft.trim() || busy}
        >
          +
        </button>
      </form>
    </section>
  );
}
