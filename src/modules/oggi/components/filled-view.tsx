"use client";

import { AreaIcon } from "@/modules/oggi/components/area-icon";
import { MetricCards } from "@/modules/oggi/components/metric-cards";
import { GoalList } from "@/modules/oggi/components/goal-list";
import { RailToday } from "@/modules/oggi/components/rail-today";
import { HeadlineEditable } from "@/modules/oggi/components/headline-editable";
import { PillRow } from "@/modules/oggi/components/pill-row";
import type {
  AreaSummary,
  Entry,
  EntryMetrics,
  FactKind,
  GoalDot,
} from "@/lib/types";
import type { DataMode } from "@/lib/data/entries";
import { useT } from "@/lib/i18n";

type Props = {
  headline?: string | null;
  snippet?: string | null;
  areas?: AreaSummary[];
  metrics: EntryMetrics | null;
  goals: GoalDot[];
  people?: string[];
  /** I luoghi della giornata (fatti di tipo luogo), accanto alle persone. */
  places?: string[];
  /** La X sulle pastiglie: toglie una voce da questa giornata. */
  onTogli?: (kind: FactKind, nome: string) => void;
  /** Cosa e stato tolto durante questa visita, per poterlo rimettere. */
  tolte?: { kind: FactKind; nome: string }[];
  onRimetti?: (kind: FactKind, nome: string) => void;
  /**
   * Presente = il titolo si puo riscrivere a mano. Lo passano le schermate
   * che hanno una giornata salvata sotto (Oggi e /giorno); dove non c'e
   * ancora niente da titolare, il titolo resta una scritta e basta.
   */
  editHeadline?: {
    dateISO: string;
    mode: DataMode;
    locked: boolean;
    onSaved: (entry: Entry) => void;
    onError?: (message: string) => void;
  } | null;
  onMetricChange: (patch: Partial<EntryMetrics>) => void;
  onGoalToggle: (label: string) => void;
  /**
   * Giornata in versione gratis (mockup due-modalita §02): niente sintesi
   * ne aree — la prima riga e gia il titolo, il resto e il TUO testo,
   * mostrato come prosa. Con un invito premium, uno solo, che non blocca.
   */
  freeProse?: { transcript: string; createdAt: string; spoken: boolean } | null;
  onSeePremium?: () => void;
  /**
   * Slot in fondo alla colonna, sotto metriche e obiettivi. Lo usa la
   * schermata della giornata per il tasto "aggiungi" (mockup
   * testo-e-giorno.html §03). Uno slot e non un bottone fisso perche su
   * Oggi quel tasto non serve: stai gia scrivendo.
   */
  footer?: React.ReactNode;
};

export function FilledView({
  headline,
  snippet,
  areas,
  metrics,
  goals,
  people,
  places,
  onTogli,
  tolte = [],
  onRimetti,
  editHeadline = null,
  onMetricChange,
  onGoalToggle,
  freeProse = null,
  onSeePremium,
  footer = null,
}: Props) {
  const t = useT();
  const hasHeadline = !!headline && headline.trim().length > 0;
  const hasSnippet = !!snippet && snippet.trim().length > 0;
  const realAreas = orderAreas(areas ?? []);
  const peopleList = (people ?? []).filter((p) => p.trim().length > 0);
  const placeList = (places ?? []).filter((p) => p.trim().length > 0);

  const proseParagraphs = freeProse
    ? freeProse.transcript
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    : [];
  const proseTime = freeProse ? timeLabel(freeProse.createdAt) : null;

  return (
    <div className="jm-fv-wrap flex flex-1 flex-col">
      {/* Stili in classi jm-fv-*: sotto lg replicano ESATTAMENTE i valori
          inline storici; da lg il mockup desktop-v1 §03 (headline 27px,
          snippet serif corsivo, aree su due colonne a card). */}
      {editHeadline ? (
        <HeadlineEditable
          headline={headline}
          locked={editHeadline.locked}
          dateISO={editHeadline.dateISO}
          mode={editHeadline.mode}
          onSaved={editHeadline.onSaved}
          onError={editHeadline.onError}
        />
      ) : hasHeadline ? (
        <h1 className="jm-fv-h">{headline}</h1>
      ) : (
        <h1 className="jm-fv-h placeholder">
          {t("giornata raccontata, l'AI non ha ancora generato un titolo")}
        </h1>
      )}

      {freeProse ? (
        <>
          {proseTime && (
            <div className="jm-fv-sub" suppressHydrationWarning>
              {t(
                freeProse.spoken ? "raccontata alle {ora}" : "scritta alle {ora}",
                { ora: proseTime },
              )}
            </div>
          )}
          <div className="jm-fv-prose">
            {proseParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="jm-fv-nudge">
            <div className="t">
              {t(
                "Con premium questa giornata avrebbe un titolo, una sintesi e le macro-aree. E la puoi raccontare a voce, invece di scriverla.",
              )}
            </div>
            {onSeePremium && (
              <button type="button" className="btn-ghost" onClick={onSeePremium}>
                {t("vedi")}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {hasSnippet && <p className="jm-fv-sn">{snippet}</p>}

          <Separator />

          {realAreas.length > 0 ? (
            <div className="jm-fv-areas">
              {realAreas.map((area) => (
                <div key={area.label} className="jm-fv-area">
                  <div className="l">
                    <AreaIcon label={area.label} />
                    {t(area.label)}
                  </div>
                  <div className="x">{area.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="jm-fv-noareas">
              {t("aree macro non ancora estratte")}
            </div>
          )}
        </>
      )}

      {/* Sotto lg: persone, metriche e obiettivi restano nella colonna, come
          sempre. Da lg in su la stessa roba vive nella rail destra (mockup
          desktop-v1 §01/§03) e qui si spegne. */}
      <div className="lg:hidden">
        {peopleList.length > 0 && (
          <div style={{ padding: "14px 0" }}>
            <div className="jm-fv-social-l">{t("Persone incontrate")}</div>
            <PillRow
              nomi={peopleList}
              kind="persona"
              variante="colonna"
              cliccabile
              onTogli={(kk, n) => onTogli?.(kk, n)}
              tolte={tolte.filter((x) => x.kind === "persona").map((x) => x.nome)}
              onRimetti={onRimetti}
            />
          </div>
        )}

        {placeList.length > 0 && (
          <div
            className="jm-places"
            style={{ padding: peopleList.length > 0 ? "0 0 14px" : "14px 0" }}
          >
            <div className="jm-fv-social-l">{t("Luoghi visitati")}</div>
            <PillRow
              nomi={placeList}
              kind="luogo"
              variante="colonna"
              onTogli={(kk, n) => onTogli?.(kk, n)}
              tolte={tolte.filter((x) => x.kind === "luogo").map((x) => x.nome)}
              onRimetti={onRimetti}
            />
          </div>
        )}

        <Separator />

        <MetricCards metrics={metrics} onChange={onMetricChange} />
        <GoalList goals={goals} onToggle={onGoalToggle} />
      </div>

      {footer}

      <RailToday
        metrics={metrics}
        goals={goals}
        people={peopleList}
        places={placeList}
        onTogli={onTogli}
        tolte={tolte}
        onRimetti={onRimetti}
        onMetricChange={onMetricChange}
        onGoalToggle={onGoalToggle}
      />
    </div>
  );
}

/**
 * L'ordine in cui le macro-aree compaiono nella giornata, e la garanzia che
 * ognuna compaia una volta sola.
 *
 * ORDINE FISSO. Il modello restituisce le aree nell'ordine in cui gli
 * vengono, quindi ieri "Cibo" stava in cima e oggi in fondo: una pagina che
 * si riordina da sola costringe a rileggerla tutta ogni volta. L'ordine
 * qui sotto segue la giornata come la si racconta: fuori (lavoro,
 * relazioni), poi il corpo (cibo, movimento, il resto), poi dentro.
 *
 * NIENTE DOPPIONI. Se il modello restituisse due volte la stessa etichetta,
 * la lista le userebbe come identificativo e le due righe si
 * sovrascriverebbero a vicenda. Qui i testi si uniscono invece di sparire.
 */
const AREA_ORDER: string[] = [
  "Lavoro",
  "Relazioni",
  "Cibo",
  "Movimento",
  "Corpo",
  "Emozioni",
];

function orderAreas(areas: AreaSummary[]): AreaSummary[] {
  const merged = new Map<string, string>();
  for (const a of areas) {
    const text = a.text.trim();
    if (text.length === 0) continue;
    const prev = merged.get(a.label);
    merged.set(a.label, prev ? `${prev} ${text}` : text);
  }
  return [...merged.entries()]
    .map(([label, text]) => ({ label, text }))
    .sort((x, y) => {
      const ix = AREA_ORDER.indexOf(x.label);
      const iy = AREA_ORDER.indexOf(y.label);
      // Un'etichetta sconosciuta (una giornata vecchia, un'area futura) va
      // in fondo invece di sparire.
      return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
    });
}

function Separator() {
  return <div className="jm-fv-sep" />;
}

function timeLabel(createdAt: string): string | null {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
