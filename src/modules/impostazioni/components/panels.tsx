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
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { contaCassaforte, portaNellaCassaforte, type StatoGiornate } from "@/lib/data/cassaforte";
import { paroleCorrenti } from "@/lib/cassaforte";
import { sedeDellaChiave } from "@/lib/cassaforte/chiave";
import { chiediIlVolto } from "@/lib/native/face-id";
import { isNative } from "@/lib/native/platform";
import { formatNumber } from "@/lib/format";
import { SetGroup, SetRow } from "@/modules/impostazioni/components/rows";
import { addGoal, removeGoal } from "@/lib/data/goals";
import { cssVarsFor, FONTS, THEMES } from "@/themes";
import { setTheme, useResolvedMode, useThemeId } from "@/themes/runtime";
import { useStorageMode } from "@/lib/data/store";
import { ospiteAttivo } from "@/lib/ospite/flag";
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
          // L'anteprima e VIVA: le variabili del tema, scoped qui, vincono
          // su quelle di <html>, quindi ogni scheda disegna davvero il suo
          // tema nel modo (chiaro/scuro) scelto adesso.
          const v = cssVarsFor(th, mode);
          // La riga sotto la miniatura NON e nel tema: e interfaccia, e usa
          // i colori dell'app. Le uniche quattro tinte del tema che le
          // servono si passano a mano, cosi le --jm-* non colano fuori
          // dall'anteprima e non riscrivono --color-* (che da esse dipende).
          const swatch = {
            "--sw-bg": v["--jm-bg-app"],
            "--sw-sur": v["--jm-surface-2"],
            "--sw-acc": v["--jm-accent"],
            "--sw-on": v["--jm-on-accent"],
          } as CSSProperties;
          const fonts =
            th.typography.fontUi === th.typography.fontProse
              ? FONTS[th.typography.fontUi].name
              : `${FONTS[th.typography.fontUi].name} + ${FONTS[th.typography.fontProse].name}`;
          return (
            <button
              key={th.id}
              type="button"
              className={`jm-theme-card${active ? " on" : ""}`}
              onClick={() => setTheme(th.id)}
              aria-pressed={active}
            >
              <span className="jm-theme-prev" style={v as CSSProperties}>
                <span className="jm-theme-mini">
                  {/* L'UNICA cosa scritta qui dentro, e su UNA riga sola.
                      Il resto sono forme: e questo che impedisce al testo di
                      un font largo, o di una lingua piu lunga, di sfondare
                      la miniatura e finire sopra il nome. */}
                  <span className="jm-theme-mt">{t("la telefonata rimandata")}</span>
                  <span className="jm-theme-bar b1" aria-hidden="true" />
                  <span className="jm-theme-bar b2" aria-hidden="true" />
                  <span className="jm-theme-bar b3" aria-hidden="true" />
                  <span className="jm-theme-bar b4" aria-hidden="true" />
                  <span className="jm-theme-bar b5" aria-hidden="true" />
                  <span className="jm-theme-pill" aria-hidden="true" />
                </span>
              </span>
              <span className="jm-theme-meta" style={swatch}>
                <span className="jm-theme-chip" aria-hidden="true">
                  <i className="ch-acc" />
                  <i className="ch-sur" />
                  <i className="ch-bg" />
                </span>
                <span className="jm-theme-txt">
                  <span className="jm-theme-name">{th.name}</span>
                  <span className="jm-theme-fonts">{fonts}</span>
                </span>
                {active ? (
                  <span className="jm-theme-ok" role="img" aria-label={t("attivo")}>
                    <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true">
                      <path
                        d="M4 10.5l4 4 8-9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : null}
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
  // L'ospite (mockup ospite-primo-avvio 04, terza schermata): la scelta
  // "dove tenere il diario" che e sparita dal primo avvio vive qui, come
  // voce. Le parole del locale "puro" (nemmeno una richiesta di rete)
  // restano solo con l'ospite spento: con l'AI in regalo non sarebbero vere.
  const ospite = isLocal && ospiteAttivo();

  return (
    <>
      <p className="jm-st-lede">
        {ospite
          ? t("Solo su questo dispositivo. Senza backup, se lo perdi le perdi.")
          : isLocal
            ? t("Nessuna riga del tuo diario e mai uscita da questo dispositivo.")
            : t(
                "Le tue giornate vivono sul tuo account e ti seguono su ogni dispositivo.",
              )}
      </p>

      {ospite ? (
        <>
          <SetGroup label={t("Dove stanno")}>
            <SetRow
              title={t("Solo su questo dispositivo")}
              value={"\u2713"}
              chevron={false}
              desc={t("Esce solo il testo, quando l'AI ci lavora.")}
            />
            <SetRow
              title={t("Anche sul server, chiuso a chiave")}
              desc={t("Con una email. Nemmeno noi possiamo leggerle.")}
              onClick={() => {
                window.location.assign("/login");
              }}
            />
          </SetGroup>
          <SetGroup label={t("Cosa esce da qui")}>
            <SetRow
              title={t("Il testo, quando l'AI ci lavora")}
              desc={t("Poi sul server non resta niente.")}
              chevron={false}
            />
          </SetGroup>
        </>
      ) : isLocal ? (
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
/**
 * Il dock in miniatura: una pillola con cinque posti, l'ultimo acceso.
 * Sta accanto al nome del modulo che occupa il quinto posto del dock.
 */
function DockGlyph() {
  const t = useT();
  return (
    <svg className="jm-st-dock-glyph" viewBox="0 0 44 16" aria-label={t("Nel dock")} role="img">
      <rect x="0.75" y="0.75" width="42.5" height="14.5" rx="7.25" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" opacity="0.35" />
      <circle cx="15" cy="8" r="1.6" fill="currentColor" opacity="0.35" />
      <circle cx="22" cy="8" r="2.6" fill="currentColor" opacity="0.35" />
      <circle cx="29" cy="8" r="1.6" fill="currentColor" opacity="0.35" />
      <circle cx="36" cy="8" r="2.2" fill="currentColor" />
    </svg>
  );
}

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
        {t("Accendi quello che vuoi. L'ultimo acceso va nel dock.")}
      </p>

      <div className="jm-st-box">
        {ordinati.map((m, i) => {
          const on = attiviIds.includes(m.id);
          const pronto = m.status === "pronto";
          // Il primo acceso e quello nel dock: lo dice un glifo, non una
          // frase (4 settembre 2026, Manuel: "senza scrivere testi").
          const nelDock = on && i === 0;
          return (
            <div
              key={m.id}
              className={`jm-st-row static${pronto ? "" : " presto"}${nelDock ? " nel-dock" : ""}`}
            >
              <span className="jm-st-grow">
                <span className="jm-st-t">
                  {t(m.label)}
                  {nelDock && <DockGlyph />}
                </span>
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

      <p className="jm-st-note">{t("Spegnere non cancella niente.")}</p>
    </>
  );
}

/* ===================== Cassaforte (SPEC ospite-e-cassaforte, R12) ===================== */

/**
 * Impostazioni > Cassaforte (mockup codice-di-recupero.html, schermata 04).
 * Dice lo stato VERO: quante giornate sono chiuse a chiave e quante sono
 * ancora in chiaro sul server (quelle scritte prima della cassaforte), e
 * offre il passaggio esplicito con un tasto suo: mai un effetto collaterale
 * di un aggiornamento. Le otto parole si rivedono dietro il volto.
 */
export function CassafortePanel() {
  const t = useT();
  const [stato, setStato] = useState<StatoGiornate | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [passo, setPasso] = useState<"fermo" | "in-corso" | "fatto">("fermo");
  const [avanzamento, setAvanzamento] = useState<{ fatte: number; totale: number } | null>(null);
  const [parole, setParole] = useState<string[] | null>(null);
  const [paroleBusy, setParoleBusy] = useState(false);

  useEffect(() => {
    let vivo = true;
    contaCassaforte()
      .then((s) => {
        if (vivo) setStato(s);
      })
      .catch((e: unknown) => {
        if (vivo) setErrore((e as Error)?.message ?? String(e));
      });
    return () => {
      vivo = false;
    };
  }, [passo]);

  async function porta() {
    setPasso("in-corso");
    setErrore(null);
    try {
      await portaNellaCassaforte((fatte, totale) => setAvanzamento({ fatte, totale }));
      setPasso("fatto");
    } catch (e) {
      setErrore((e as Error)?.message ?? String(e));
      setPasso("fermo");
    }
  }

  async function vediParole() {
    setParoleBusy(true);
    try {
      const ok = await chiediIlVolto(t("Per vedere il codice di recupero"));
      if (!ok) return;
      setParole(await paroleCorrenti());
    } finally {
      setParoleBusy(false);
    }
  }

  const inChiaro = (stato?.inChiaro ?? 0) + (stato?.righeInChiaro ?? 0);
  const tuttoChiuso = stato !== null && inChiaro === 0;

  return (
    <>
      {stato && inChiaro > 0 && passo !== "fatto" ? (
        <>
          <p className="jm-st-lede">
            {stato.inChiaro > 0
              ? t("{n} giornate sono ancora in chiaro sul server.", { n: formatNumber(stato.inChiaro) })
              : t("{n} righe (memo, recap, domande) sono ancora in chiaro sul server.", { n: formatNumber(stato.righeInChiaro) })}
          </p>
          <p className="jm-st-lede">
            {t(
              "Sono state scritte prima della cassaforte. Chiuderle a chiave le rende illeggibili per chiunque non abbia la tua chiave, noi compresi. Ci vuole meno di un minuto e non tocca il testo.",
            )}
          </p>
          <div className="jm-st-cassa-azione">
            <Button onClick={() => void porta()} disabled={passo === "in-corso"}>
              {passo === "in-corso"
                ? avanzamento
                  ? t("Chiudo a chiave... {fatte} di {totale}", { fatte: avanzamento.fatte, totale: avanzamento.totale })
                  : t("Chiudo a chiave...")
                : stato.inChiaro > 0
                  ? t("Chiudi a chiave le {n} giornate", { n: formatNumber(stato.inChiaro) })
                  : t("Chiudi a chiave tutto")}
            </Button>
          </div>
        </>
      ) : null}
      {passo === "fatto" ? (
        <p className="jm-st-lede">{t("Fatto: tutto quello che era in chiaro adesso e chiuso a chiave.")}</p>
      ) : null}
      {errore ? <p className="jm-st-lede jm-st-cassa-errore">{errore}</p> : null}

      <SetGroup label={t("Stato")}>
        <SetRow
          title={t("Stato")}
          value={
            stato === null
              ? undefined
              : tuttoChiuso
                ? t("Tutto chiuso a chiave")
                : t("{n} in chiaro", { n: formatNumber(inChiaro) })
          }
        />
        <SetRow title={t("Giornate nella cassaforte")} value={stato ? formatNumber(stato.chiuse) : undefined} />
        <SetRow
          title={t("La chiave su questo dispositivo")}
          value={sedeDellaChiave() === "portachiavi" ? t("Nel portachiavi di iCloud") : t("In questo browser")}
        />
        <SetRow
          title={t("Vedi il codice di recupero")}
          desc={parole ? parole.join(" ") : undefined}
          value={parole ? undefined : isNative() ? t("Face ID") : undefined}
          onClick={parole ? undefined : () => void vediParole()}
          disabled={paroleBusy}
        />
      </SetGroup>
      <SetGroup label={t("Cosa vede il server")}>
        <SetRow
          title={t("Di chi e ogni giornata, che giorno e, la versione, quando e stata scritta e quanto pesa.")}
          desc={t("Il testo, il titolo, la sintesi, le aree, i fatti, i memo e i recap: no.")}
        />
      </SetGroup>
    </>
  );
}
