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
import { SetGroup, SetRow } from "@/modules/impostazioni/components/rows";
import { addGoal, removeGoal } from "@/lib/data/goals";
import { cssVarsFor, FONTS, THEMES } from "@/themes";
import { setTheme, useResolvedMode, useThemeId } from "@/themes/runtime";
import { useStorageMode } from "@/lib/data/store";
import {
  DEFAULT_UI_SCALE,
  setUiScale,
  UI_SCALES,
  UI_SCALE_LABELS,
  useUiScale,
} from "@/lib/ui-scale";
import {
  detectSystemLang,
  setLangPref,
  useLangPref,
  useT,
  type LangPref,
} from "@/lib/i18n";
import { MODULES, setModuleActive, useActiveModules } from "@/lib/modules";
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

/* ===================== Dimensione del testo ===================== */

/**
 * La scelta della dimensione (mockup design/mockups/testo-e-giorno.html
 * §02, approvato). Due cose che non sono decorazione:
 *
 *  1. OGNI RIGA E DISEGNATA ALLA SUA MISURA. La parola "Massimo" e scritta
 *     grande davvero. Chi apre questa schermata lo fa perche non vede
 *     bene: farlo scegliere fra nomi tutti della stessa taglia, o peggio
 *     fra percentuali, vuol dire fargli indovinare.
 *  2. NESSUN TASTO "SALVA". Si tocca e l'app cambia sotto le dita, e
 *     l'anteprima in cima cambia con lei. Se la misura non va bene la si
 *     cambia di nuovo: e l'unico modo di sceglierla, guardandola.
 */
export function TextSizePanel() {
  const t = useT();
  const scale = useUiScale();

  return (
    <>
      <p className="jm-st-lede">
        {t(
          "Ingrandisce tutta l'app: scritte, tasti e spazi insieme. Cosi niente si accavalla.",
        )}
      </p>

      <div className="jm-st-prev">
        <div className="jm-st-prev-l">{t("Anteprima")}</div>
        <div className="jm-st-prev-h">{t("la telefonata rimandata")}</div>
        <div className="jm-st-prev-p">
          {t("Trentadue minuti, e una frase alla fine.")}
        </div>
      </div>

      <div className="jm-st-box">
        {UI_SCALES.map((v) => {
          const on = v === scale;
          return (
            <button
              key={v}
              type="button"
              className={`jm-st-szrow${on ? " on" : ""}`}
              // La riga si disegna alla misura che rappresenta: e il punto
              // di tutta la schermata. Qui il valore e assoluto e NON
              // moltiplicato per --jm-ui-scale: queste cinque righe devono
              // mostrare le cinque misure, non la misura corrente cinque
              // volte. L'altezza cresce con il testo perche e min-height.
              style={{ fontSize: `${15 * v}px`, minHeight: 56 * v }}
              onClick={() => setUiScale(v)}
              aria-pressed={on}
            >
              <span className="jm-st-szname">
                {t(UI_SCALE_LABELS[String(v)])}
              </span>
              <span className="jm-st-szdemo" aria-hidden="true">
                Aa
              </span>
              {on && <span className="jm-st-szcheck">{"\u2713"}</span>}
            </button>
          );
        })}
      </div>

      {scale !== DEFAULT_UI_SCALE && (
        <button
          type="button"
          className="jm-st-out"
          style={{ marginTop: 18 }}
          onClick={() => setUiScale(DEFAULT_UI_SCALE)}
        >
          {t("Torna alla misura normale")}
        </button>
      )}
    </>
  );
}

/**
 * Moduli: le sezioni in piu (mockup design/mockups/palestra.html §07,
 * approvato il 21 agosto 2026).
 *
 * Due cose sono scritte a schermo e non lasciate intuire, perche sono le
 * due domande che si fa chiunque tocchi un interruttore:
 *
 *  1. COSA SUCCEDE ACCENDENDO: il modulo prende il quarto posto nella barra
 *     in basso, e il piu recente vince sugli altri.
 *  2. COSA SUCCEDE SPEGNENDO: niente viene cancellato. E la paura vera, e
 *     una riga di testo costa meno di un utente che non prova mai.
 *
 * I moduli non ancora pronti compaiono con scritto "presto" e l'interruttore
 * non si muove: uno che si muove senza che succeda niente e peggio di uno
 * assente.
 */
export function ModuliPanel() {
  const t = useT();
  const attivi = useActiveModules();
  const attiviIds = attivi.map((m) => m.id);
  // L'ordine mostrato e quello vero: gli accesi in cima, il piu recente per
  // primo. Cosi l'elenco stesso dice chi comanda la quarta icona.
  const ordinati = [
    ...attivi,
    ...MODULES.filter((m) => !attiviIds.includes(m.id)),
  ];

  return (
    <>
      <p className="jm-st-lede">
        {t(
          "Sezioni in piu, accese solo se le vuoi. Quella che accendi per ultima prende il quarto posto nella barra in basso; sul computer ci sono tutte nella colonna di sinistra.",
        )}
      </p>

      <div className="jm-st-box">
        {ordinati.map((m) => {
          const on = attiviIds.includes(m.id);
          const pronto = m.status === "pronto";
          return (
            <div
              key={m.id}
              className={`jm-st-row static${pronto ? "" : " presto"}`}
            >
              <span className="jm-st-grow">
                <span className="jm-st-t">{t(m.label)}</span>
                <span className="jm-st-d">
                  {pronto ? t(m.description) : t("Presto")}
                </span>
              </span>
              {pronto ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t(m.label)}
                  className={`jm-sw${on ? " on" : ""}`}
                  onClick={() => setModuleActive(m.id, !on)}
                >
                  <i aria-hidden="true" />
                </button>
              ) : (
                <span className="jm-st-val">{t("presto")}</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="jm-st-note">
        {t(
          "Spegnendo un modulo la voce sparisce dalla barra, ma quello che hai registrato resta dov'e: riaccendendolo lo ritrovi.",
        )}
      </p>
    </>
  );
}
