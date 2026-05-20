"use client";

import { useState } from "react";
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

  const commit = async (next: string[]) => {
    setTerms(next);
    onChange(next);
    setSaving(true);
    try {
      await saveGlossary(mode, next);
    } catch {
      // best-effort: keep the local state even if save fails
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const t = draft.trim();
    if (!t) return;
    // dedupe case-insensitive
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
