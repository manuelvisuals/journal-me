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
import {
  detectSystemLang,
  setLangPref,
  useLangPref,
  useT,
  type LangPref,
} from "@/lib/i18n";
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
  const t = useT();
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    // `label` e non `t`: `t` e la funzione di traduzione.
    const label = draft.trim();
    if (!label || busy) return;
    if (goals.some((g) => g.label.toLowerCase() === label.toLowerCase())) {
      setDraft("");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await addGoal(mode, label);
      setGoals((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Errore nel salvataggio"));
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
      setError(err instanceof Error ? err.message : t("Errore nella rimozione"));
    }
  };

  return (
    <>
      <p className="jm-st-lede">
        {t(
          "Tracker neutri, niente voti: rispondono a \u201coggi l'ho fatto?\u201d e basta. Compaiono nella giornata come caselle da accendere.",
        )}
      </p>

      <SetGroup label={busy ? t("Attivi . salvo...") : t("Attivi")}>
        {goals.length === 0 && (
          <SetRow
            title={t("Nessun obiettivo")}
            desc={t("Aggiungine uno qui sotto: comparira subito nella giornata.")}
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
              aria-label={t("Rimuovi {nome}", { nome: g.label })}
              onClick={() => void handleRemove(g.id)}
            >
              {t("togli")}
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
          placeholder={t("Aggiungi un obiettivo...")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label={t("Nuovo obiettivo")}
        />
        <button type="submit" disabled={!draft.trim() || busy}>
          {t("aggiungi")}
        </button>
      </form>
    </>
  );
}

/* ===================== Tema ===================== */

export function ThemePanel() {
  const t = useT();
  const themeId = useThemeId();
  const mode = useResolvedMode();

  return (
    <>
      <p className="jm-st-lede">
        {t(
          "Il tema cambia solo come si vede l'app. Le tue giornate non le tocca nessuno.",
        )}
      </p>

      <div className="jm-theme-grid">
        {THEMES.map((th) => {
          const active = th.id === themeId;
          const vars = cssVarsFor(th, mode) as CSSProperties;
          return (
            <button
              key={th.id}
              type="button"
              className={`jm-theme-card${active ? " on" : ""}`}
              onClick={() => setTheme(th.id)}
              aria-pressed={active}
            >
              <span className="jm-theme-prev" style={vars}>
                <span className="jm-theme-prev-t">
                  {t("la telefonata rimandata")}
                </span>
                <span className="jm-theme-prev-p">
                  {t("Trentadue minuti, e una frase alla fine.")}
                </span>
                <span className="jm-theme-sw" aria-hidden="true">
                  <i className="sw-accent" />
                  <i className="sw-surface" />
                  <i className="sw-ink" />
                  <i className="sw-faint" />
                </span>
              </span>
              <span className="jm-theme-meta">
                <span className="jm-theme-name">{th.name}</span>
                <span className="jm-theme-fonts">
                  {th.typography.fontUi === th.typography.fontProse
                    ? FONTS[th.typography.fontUi].name
                    : `${FONTS[th.typography.fontUi].name} + ${FONTS[th.typography.fontProse].name}`}
                  {active ? ` . ${t("attivo")}` : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="jm-theme-footnote">
        {t(
          "Ogni tema esiste in chiaro e in scuro, e passa un controllo automatico sul contrasto: un tema che rende il testo illeggibile non diventa selezionabile.",
        )}
      </div>
    </>
  );
}

/* ===================== Dove sono le mie giornate ===================== */

export function WherePanel() {
  const t = useT();
  const mode = useStorageMode();
  const isLocal = mode === "local";

  return (
    <>
      <p className="jm-st-lede">
        {isLocal
          ? t("Nessuna riga del tuo diario e mai uscita da questo dispositivo.")
          : t(
              "Le tue giornate vivono sul tuo account e ti seguono su ogni dispositivo.",
            )}
      </p>

      {isLocal ? (
        <>
          <SetGroup label={t("Dove stanno")}>
            <SetRow
              title={t("Solo su questo dispositivo")}
              desc={t("Non c'e un account, non c'e un server, non c'e niente da chiedere di cancellare. L'app non fa nemmeno una richiesta di rete.")}
            />
            <SetRow
              title={t("Se il dispositivo si rompe")}
              desc={t("Il diario e finito. Non esiste una copia da nessuna parte: l'unica rete di salvataggio e il backup che esporti tu.")}
            />
          </SetGroup>
          <SetGroup label={t("Cosa esce da qui")}>
            <SetRow
              title={t("Niente")}
              desc={t("Voce, riassunti e recap sono spenti in questa modalita proprio perche girerebbero su un server.")}
            />
          </SetGroup>
        </>
      ) : (
        <>
          <SetGroup label={t("Dove stanno")}>
            <SetRow
              title={t("Sul tuo account, nel cloud")}
              desc={t("Ti seguono su ogni dispositivo dove fai l'accesso. Il backup qui sopra resta una copia in piu, tua.")}
            />
          </SetGroup>
          <SetGroup label={t("Cosa esce da qui")}>
            <SetRow
              title={t("Quello che chiedi tu")}
              desc={t("Registrazione, riassunto e recap passano da un server per essere elaborati. Il resto no.")}
            />
          </SetGroup>
        </>
      )}
    </>
  );
}

/* ===================== Lingua ===================== */

export const LANG_NAMES: Record<"it" | "en", string> = {
  it: "Italiano",
  en: "English",
};

/**
 * La schermata Lingua. Tre voci, non due: "Come il dispositivo" e la
 * PREDEFINITA e resta selezionabile anche dopo che hai scelto a mano —
 * altrimenti chi cambia telefono o parte in vacanza non ha piu modo di
 * tornare all'automatico senza svuotare i dati del browser.
 *
 * I nomi delle lingue non si traducono: "English" si scrive English anche
 * in italiano, ed e cosi che lo riconosce chi non capisce la lingua in cui
 * l'app sta parlando adesso.
 */
export function LanguagePanel() {
  const t = useT();
  const pref = useLangPref();
  const system = detectSystemLang();

  const rows: { value: LangPref; title: string; desc?: string }[] = [
    { value: "it", title: LANG_NAMES.it },
    { value: "en", title: LANG_NAMES.en },
    {
      value: "system",
      title: t("Come il dispositivo"),
      desc: t("Ora sarebbe {lingua}.", { lingua: LANG_NAMES[system] }),
    },
  ];

  return (
    <>
      <p className="jm-st-lede">
        {t(
          "Cambia solo le parole dell'app. Quello che hai scritto tu resta come l'hai scritto.",
        )}
      </p>

      <SetGroup label={t("Lingua")}>
        {rows.map((r) => (
          <SetRow
            key={r.value}
            title={r.title}
            desc={r.desc}
            value={pref === r.value ? "\u2713" : undefined}
            chevron={false}
            onClick={() => setLangPref(r.value)}
          />
        ))}
      </SetGroup>
    </>
  );
}
