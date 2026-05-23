"use client";

import { useRef, useState } from "react";

type Props = {
  /** People already in the roster that were mentioned today (read-only chips). */
  existing: string[];
  /** AI-suggested new people to confirm/correct before saving. */
  suggested: string[];
  /**
   * Confirm: `allPeople` = everyone related to today (existing + kept new),
   * `newOnes` = the new names to insert into Remember > Persone.
   */
  onConfirm: (allPeople: string[], newOnes: string[]) => void;
  onSkip: (existingPeople: string[]) => void;
  saving?: boolean;
};

type NewPerson = { id: string; value: string };

let _id = 0;
function nextId(): string {
  _id += 1;
  return `np-${_id}`;
}

/**
 * Shown after AI processing when the recording mentioned people. Existing
 * people are confirmed silently (no duplicates); new ones appear as editable
 * pills so the user can fix spelling / mis-transcribed names, remove wrong
 * detections, or add people the AI missed — then save them all to Remember.
 */
export function PeopleReview({
  existing,
  suggested,
  onConfirm,
  onSkip,
  saving = false,
}: Props) {
  const [newPeople, setNewPeople] = useState<NewPerson[]>(
    suggested.map((s) => ({ id: nextId(), value: s })),
  );
  const lastInputRef = useRef<HTMLInputElement | null>(null);

  const updateValue = (id: string, value: string) => {
    setNewPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, value } : p)),
    );
  };

  const removePerson = (id: string) => {
    setNewPeople((prev) => prev.filter((p) => p.id !== id));
  };

  const addPerson = () => {
    const fresh = { id: nextId(), value: "" };
    setNewPeople((prev) => [...prev, fresh]);
    // Focus the new field on next paint.
    requestAnimationFrame(() => lastInputRef.current?.focus());
  };

  const handleConfirm = () => {
    const kept = dedupe(newPeople.map((p) => p.value));
    const all = dedupe([...existing, ...kept]);
    onConfirm(all, kept);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "var(--color-bg-phone)",
        backgroundImage:
          "radial-gradient(140% 90% at 12% -6%, rgba(120,40,46,.18), transparent 55%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col" style={{ minHeight: 0 }}>
        <header style={{ padding: "30px 24px 6px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-accent)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          >
            persone di oggi
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 24px 0" }}>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-ink-muted)",
              lineHeight: 1.55,
              margin: "0 0 22px",
            }}
          >
            Ho riconosciuto chi hai nominato. Controlla i nomi (potrei aver
            sbagliato lo spelling), poi salvali in Remember.
          </p>

          {existing.length > 0 && (
            <>
              <div className="jm-pr-label">gia in remember</div>
              <div className="jm-pill-row" style={{ marginBottom: 22 }}>
                {existing.map((name) => (
                  <span key={name} className="jm-person-pill is-known">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-success)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="13"
                      height="13"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {name}
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="jm-pr-label accent">
            {newPeople.length > 0 ? "nuove . tocca per correggere" : "nuove persone"}
          </div>
          <div className="jm-pill-row">
            {newPeople.map((p, idx) => (
              <span key={p.id} className="jm-person-pill is-new">
                <span className="jm-person-dot" aria-hidden="true" />
                <input
                  ref={idx === newPeople.length - 1 ? lastInputRef : undefined}
                  className="jm-person-input"
                  value={p.value}
                  onChange={(e) => updateValue(p.id, e.target.value)}
                  size={Math.max(p.value.length, 4)}
                  spellCheck={false}
                  autoCapitalize="words"
                  autoComplete="off"
                  aria-label="Nome persona"
                />
                <button
                  type="button"
                  className="x"
                  aria-label={`Rimuovi ${p.value || "persona"}`}
                  onClick={() => removePerson(p.id)}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <button
            type="button"
            className="jm-add-person"
            onClick={addPerson}
          >
            + aggiungi persona
          </button>
        </div>

        <div style={{ padding: "14px 24px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? "Salvo..." : "Salva e continua"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onSkip(existing)}
            disabled={saving}
          >
            Salta
          </button>
        </div>
      </div>
    </div>
  );
}

function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
