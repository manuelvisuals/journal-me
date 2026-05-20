"use client";

import { useRef, useState } from "react";
import { saveGlossary } from "@/lib/data/glossary";
import type { DataMode } from "@/lib/data/entries";

type Props = {
  mode: DataMode;
  initial: string[];
  onChange: (terms: string[]) => void;
};

export function GlossarySection({ mode, initial, onChange }: Props) {
  const [terms, setTerms] = useState<string[]>(initial);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Latest desired state — written synchronously on every commit. The save
  // worker reads from here so concurrent edits collapse into a single
  // ultimate upsert with the most recent value.
  const latestRef = useRef<string[]>(initial);
  // Promise of the currently running save, if any. New commits chain after
  // it so writes serialize and never race.
  const savingPromiseRef = useRef<Promise<void> | null>(null);

  const persist = (next: string[]): Promise<void> => {
    latestRef.current = next;
    if (savingPromiseRef.current) {
      // A save is already in flight: it will pick up latestRef in its
      // next iteration. No need to start another.
      return savingPromiseRef.current;
    }
    setSaving(true);
    setError(null);
    const run = (async () => {
      let lastSent: string[] | null = null;
      try {
        while (true) {
          const snapshot = latestRef.current;
          if (lastSent !== null && arraysEqual(snapshot, lastSent)) break;
          lastSent = snapshot;
          await saveGlossary(mode, snapshot);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Errore nel salvataggio",
        );
      } finally {
        savingPromiseRef.current = null;
        setSaving(false);
      }
    })();
    savingPromiseRef.current = run;
    return run;
  };

  const commit = (next: string[]) => {
    setTerms(next);
    onChange(next);
    void persist(next);
  };

  const handleAdd = () => {
    const t = draft.trim();
    if (!t) return;
    const exists = terms.some((x) => x.toLowerCase() === t.toLowerCase());
    if (exists) {
      setDraft("");
      return;
    }
    commit([...terms, t]);
    setDraft("");
  };

  const handleRemove = (idx: number) => {
    commit(terms.filter((_, i) => i !== idx));
  };

  return (
    <section className="jm-set-section">
      <div className="jm-set-section-h">
        Glossario {saving && <span style={{ opacity: 0.55 }}>. salvo...</span>}
      </div>
      <div className="jm-set-section-hint">
        Nomi propri che usi spesso. <b>L&apos;AI li riconosce</b> e non li
        sbaglia durante la trascrizione.
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

      {terms.length > 0 && (
        <div className="jm-glossary">
          {terms.map((t, i) => (
            <span key={`${t}-${i}`} className="jm-gloss-tag">
              {t}
              <button
                type="button"
                className="x"
                aria-label={`Rimuovi ${t}`}
                onClick={() => handleRemove(i)}
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
          handleAdd();
        }}
        className="jm-gloss-input"
      >
        <input
          type="text"
          placeholder="Aggiungi nome o termine..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
        />
        <button
          type="submit"
          className="add"
          aria-label="Aggiungi"
          disabled={!draft.trim()}
        >
          +
        </button>
      </form>
    </section>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
