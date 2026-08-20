"use client";

/**
 * I pannelli di Impostazioni: quello che non sta in una riga.
 *
 * Sul telefono sono fogli a tutta pagina, su desktop pannelli nella stessa
 * colonna con un "indietro" — che e esattamente lo stesso componente, perche
 * la colonna centrale e la stessa in tutte e due i casi (mockup
 * impostazioni.html §03, nota finale).
 */

import type { CSSProperties } from "react";
import { useState } from "react";
import { SetGroup, SetRow } from "@/components/settings/rows";
import { addGoal, removeGoal } from "@/lib/data/goals";
import { cssVarsFor, FONTS, THEMES } from "@/themes";
import { setTheme, useResolvedMode, useThemeId } from "@/themes/runtime";
import { useStorageMode } from "@/lib/data/store";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

/* ===================== Obiettivi ===================== */

export function GoalsPanel({
  mode,
  goals,
  setGoals,
}: {
  mode: DataMode;
  goals: GoalDef[];
  setGoals: (fn: (prev: GoalDef[]) => GoalDef[]) => void;
}) {
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
    let snapshot: GoalDef[] = [];
    setGoals((prev) => {
      snapshot = prev;
      return prev.filter((x) => x.id !== id);
    });
    setError(null);
    try {
      await removeGoal(mode, id);
    } catch (err) {
      setGoals(() => snapshot);
      setError(err instanceof Error ? err.message : "Errore nella rimozione");
    }
  };

  return (
    <>
      <p className="jm-st-lede">
        Tracker neutri, niente voti: rispondono a &ldquo;oggi l&apos;ho
        fatto?&rdquo; e basta. Compaiono nella giornata come caselle da
        accendere.
      </p>

      <SetGroup label={busy ? "Attivi . salvo..." : "Attivi"}>
        {goals.length === 0 && (
          <SetRow
            title="Nessun obiettivo"
            desc="Aggiungine uno qui sotto: comparira subito nella giornata."
          />
        )}
        {goals.map((g) => (
          <div key={g.id} className="jm-st-row static">
            <span className="jm-st-grow">
              <span className="jm-st-t">{g.label}</span>
            </span>
            <button
              type="button"
              className="jm-st-x"
              aria-label={`Rimuovi ${g.label}`}
              onClick={() => void handleRemove(g.id)}
            >
              togli
            </button>
          </div>
        ))}
      </SetGroup>

      {error && (
        <div role="alert" className="jm-st-note err">
          {error}
        </div>
      )}

      <form
        className="jm-st-add"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <input
          type="text"
          placeholder="Aggiungi un obiettivo..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Nuovo obiettivo"
        />
        <button type="submit" disabled={!draft.trim() || busy}>
          aggiungi
        </button>
      </form>
    </>
  );
}

/* ===================== Tema ===================== */

export function ThemePanel() {
  const themeId = useThemeId();
  const mode = useResolvedMode();

  return (
    <>
      <p className="jm-st-lede">
        Il tema cambia solo come si vede l&apos;app. Le tue giornate non le
        tocca nessuno.
      </p>

      <div className="jm-theme-grid">
        {THEMES.map((t) => {
          const active = t.id === themeId;
          const vars = cssVarsFor(t, mode) as CSSProperties;
          return (
            <button
              key={t.id}
              type="button"
              className={`jm-theme-card${active ? " on" : ""}`}
              onClick={() => setTheme(t.id)}
              aria-pressed={active}
            >
              <span className="jm-theme-prev" style={vars}>
                <span className="jm-theme-prev-t">la telefonata rimandata</span>
                <span className="jm-theme-prev-p">
                  Trentadue minuti, e una frase alla fine.
                </span>
                <span className="jm-theme-sw" aria-hidden="true">
                  <i className="sw-accent" />
                  <i className="sw-surface" />
                  <i className="sw-ink" />
                  <i className="sw-faint" />
                </span>
              </span>
              <span className="jm-theme-meta">
                <span className="jm-theme-name">{t.name}</span>
                <span className="jm-theme-fonts">
                  {t.typography.fontUi === t.typography.fontProse
                    ? FONTS[t.typography.fontUi].name
                    : `${FONTS[t.typography.fontUi].name} + ${FONTS[t.typography.fontProse].name}`}
                  {active ? " . attivo" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="jm-theme-footnote">
        Ogni tema esiste in chiaro e in scuro, e passa un controllo automatico
        sul contrasto: un tema che rende il testo illeggibile non diventa
        selezionabile.
      </div>
    </>
  );
}

/* ===================== Dove sono le mie giornate ===================== */

export function WherePanel() {
  const mode = useStorageMode();
  const isLocal = mode === "local";

  return (
    <>
      <p className="jm-st-lede">
        {isLocal
          ? "Nessuna riga del tuo diario e mai uscita da questo dispositivo."
          : "Le tue giornate vivono sul tuo account e ti seguono su ogni dispositivo."}
      </p>

      {isLocal ? (
        <>
          <SetGroup label="Dove stanno">
            <SetRow
              title="Solo su questo dispositivo"
              desc="Non c'e un account, non c'e un server, non c'e niente da chiedere di cancellare. L'app non fa nemmeno una richiesta di rete."
            />
            <SetRow
              title="Se il dispositivo si rompe"
              desc="Il diario e finito. Non esiste una copia da nessuna parte: l'unica rete di salvataggio e il backup che esporti tu."
            />
          </SetGroup>
          <SetGroup label="Cosa esce da qui">
            <SetRow
              title="Niente"
              desc="Voce, riassunti e recap sono spenti in questa modalita proprio perche girerebbero su un server."
            />
          </SetGroup>
        </>
      ) : (
        <>
          <SetGroup label="Dove stanno">
            <SetRow
              title="Sul tuo account, nel cloud"
              desc="Ti seguono su ogni dispositivo dove fai l'accesso. Il backup qui sopra resta una copia in piu, tua."
            />
          </SetGroup>
          <SetGroup label="Cosa esce da qui">
            <SetRow
              title="Quello che chiedi tu"
              desc="Registrazione, riassunto e recap passano da un server per essere elaborati. Il resto no."
            />
          </SetGroup>
        </>
      )}
    </>
  );
}
