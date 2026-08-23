"use client";

/**
 * Il Mese a griglia (SPEC-v2 §5.6, mockup desktop-v1 §04): solo da lg.
 * Sette colonne, celle 112px, oggi con bordo ambra e gradiente caldo,
 * giorni futuri al 30%, vuoti passati in serif corsivo ("vuota", come nel
 * mockup approvato). Sotto lg resta il feed verticale di sempre: stessa
 * route, stesso componente client, layout diverso.
 *
 * La rail destra mostra le statistiche del mese: si calcolano QUI, in
 * locale, senza AI — quindi esistono anche in gratis (§5.6). La card
 * Pattern e un teaser onesto: niente numeri inventati, la lettura vera
 * arriva col motore dei pattern (M4) e resta premium (PR 10).
 */

import { RailRight } from "@/components/desktop/rail-right";
import { useCan } from "@/lib/capabilities";
import {
  formatDecimal,
  formatNumber,
  daysInMonth,
  formatMonthTitle,
} from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Entry, Mood } from "@/lib/types";

type Today = { year: number; month: number; day: number };

type Props = {
  year: number;
  month: number; // 1-based
  entries: Entry[];
  today: Today;
  onTitleClick: () => void;
  /** Un mese avanti (+1) o indietro (-1). Vedi design/mockups/mese-navigazione.html. */
  onStep: (delta: -1 | 1) => void;
  onDayClick: (iso: string) => void;
  /** Oggi senza giornata: si va a scriverla. */
  onWriteToday: () => void;
};

// Il titolo del mese arriva da formatMonthTitle(), che segue la lingua.
// Le iniziali dei giorni restano una lista: sono le sette caselle della
// griglia e vanno tradotte come gruppo, non una per una.
const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

const MOOD_VALUE: Record<Mood, number> = {
  great: 5,
  good: 4,
  neutral: 3,
  low: 2,
  bad: 1,
};

type Cell = {
  key: string;
  day: number;
  kind: "out" | "future" | "empty" | "full";
  isToday: boolean;
  iso: string | null;
  entry: Entry | null;
};

function buildCells(
  year: number,
  month: number,
  entries: Entry[],
  today: Today,
): Cell[] {
  const byDay = new Map<number, Entry>();
  for (const e of entries) {
    const d = Number(e.entryDate.slice(8, 10));
    byDay.set(d, e);
  }
  const total = daysInMonth(year, month);
  // getDay(): 0=domenica; la griglia parte dal lunedi.
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const prevTotal = daysInMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);

  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({
      key: `p${prevTotal - i}`,
      day: prevTotal - i,
      kind: "out",
      isToday: false,
      iso: null,
      entry: null,
    });
  }
  const afterToday = (d: number) =>
    year > today.year ||
    (year === today.year &&
      (month > today.month || (month === today.month && d > today.day)));
  for (let d = 1; d <= total; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const entry = byDay.get(d) ?? null;
    const isToday =
      year === today.year && month === today.month && d === today.day;
    cells.push({
      key: iso,
      day: d,
      kind: afterToday(d) ? "future" : entry ? "full" : "empty",
      isToday,
      iso,
      entry,
    });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      key: `n${next}`,
      day: next++,
      kind: "out",
      isToday: false,
      iso: null,
      entry: null,
    });
  }
  return cells;
}

export function MeseGrid({
  year,
  month,
  entries,
  today,
  onTitleClick,
  onStep,
  onDayClick,
  onWriteToday,
}: Props) {
  const t = useT();
  const canPatterns = useCan("patterns");
  const cells = buildCells(year, month, entries, today);

  // ---- statistiche del mese (niente AI, valgono anche in gratis) ----
  const isCurrent = year === today.year && month === today.month;
  const passed = isCurrent ? today.day : daysInMonth(year, month);
  const done = entries.length;

  const moods = entries
    .map((e) => (e.metrics?.mood ? MOOD_VALUE[e.metrics.mood] : null))
    .filter((v): v is number => v !== null);
  const moodAvg =
    moods.length > 0
      ? moods.reduce((a, b) => a + b, 0) / moods.length
      : null;

  const goalCount = new Map<string, number>();
  for (const e of entries) {
    for (const g of e.goals) {
      if (g.on) goalCount.set(g.label, (goalCount.get(g.label) ?? 0) + 1);
    }
  }
  const topGoal = [...goalCount.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const words = entries.reduce((sum, e) => {
    const t = e.transcript.trim();
    return sum + (t ? t.split(/\s+/).length : 0);
  }, 0);

  return (
    <>
      <div className="jm-mese-wrap">
        <div className="jm-mese-head">
          {/* Titolo a sinistra e frecce all'altro capo della riga: e la
              variante 03 del mockup, scelta da Manuel il 21 agosto. Una
              freccia PRIMA del titolo lo avrebbe spinto 48px a destra e il
              mese non sarebbe piu stato incolonnato con il lunedi della
              griglia. Il titolo resta un bottone e continua ad aprire il
              salto rapido: le frecce fanno il gesto corto, lui quello lungo. */}
          <div className="jm-mese-hrow">
            <button
              type="button"
              className="jm-mese-t"
              onClick={onTitleClick}
              aria-haspopup="dialog"
            >
              {formatMonthTitle(year, month)}
            </button>
            <div className="jm-mese-navpair">
              <button
                type="button"
                className="jm-mese-nav"
                onClick={() => onStep(-1)}
                aria-label={t("Mese precedente")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              {/* Sul mese corrente resta al suo posto, spento: se sparisse,
                  il titolo ballerebbe ogni volta che si torna a oggi. */}
              <button
                type="button"
                className="jm-mese-nav"
                onClick={() => onStep(1)}
                disabled={isCurrent}
                aria-label={t("Mese successivo")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
          <div className="jm-mese-s" suppressHydrationWarning>
            {t("{fatte} giornate raccontate su {totali} {periodo}", {
              fatte: formatNumber(done),
              totali: formatNumber(passed),
              periodo: isCurrent ? t("passate") : t("del mese"),
            })}
          </div>
        </div>
        <div className="jm-mese-wk" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <div key={w}>{t(w)}</div>
          ))}
        </div>
        <div className="jm-mese-grid">
          {cells.map((c) => {
            const cls = `jm-mese-cell ${c.kind}${c.isToday ? " today" : ""}`;
            const clickable =
              c.kind === "full" || (c.isToday && c.kind === "empty");
            if (!clickable) {
              return (
                <div key={c.key} className={cls}>
                  <div className="jm-mese-cn">{c.day}</div>
                  {c.kind === "empty" && (
                    <div className="jm-mese-ch">{t("vuota")}</div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={c.key}
                type="button"
                className={cls}
                onClick={() =>
                  c.entry && c.iso ? onDayClick(c.iso) : onWriteToday()
                }
              >
                <div className="jm-mese-cn">{c.day}</div>
                {c.entry ? (
                  <>
                    <div className="jm-mese-ch">
                      {c.entry.headline ?? c.entry.snippet ?? ""}
                    </div>
                    {c.entry.goals.length > 0 && (
                      <div className="jm-mese-dots" aria-hidden="true">
                        {c.entry.goals.map((g) => (
                          <i key={g.id} className={g.on ? "on" : undefined} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="jm-mese-ch">{t("vuota")}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <RailRight>
        <div className="jm-railr-sec">
          <div className="jm-railr-l">{t("Il mese")}</div>
          <div className="jm-railr-stat">
            <div className="v" suppressHydrationWarning>
              {formatNumber(done)}
              <span>/{formatNumber(passed)}</span>
            </div>
            <div className="k">{t("giornate raccontate")}</div>
          </div>
          <div className="jm-railr-stat">
            <div className="v">
              {moodAvg !== null ? formatDecimal(moodAvg, 1) : "-"}
            </div>
            <div className="k">{t("umore medio")}</div>
          </div>
          {topGoal && (
            <div className="jm-railr-stat">
              <div className="v">{formatNumber(topGoal[1])}</div>
              <div className="k">
                {t("giorni con {obiettivo}", { obiettivo: topGoal[0] })}
              </div>
            </div>
          )}
          <div className="jm-railr-stat">
            <div className="v">{formatNumber(words)}</div>
            <div className="k">{t("parole scritte")}</div>
          </div>
        </div>
        <div className="jm-railr-sec">
          <div className="jm-railr-l">
            Pattern
            {!canPatterns && (
              <span className="jm-railr-pill">{t("premium")}</span>
            )}
          </div>
          <div className="jm-railr-locked">
            <div className="t">{t("Le letture sui pattern arrivano da qui.")}</div>
            <div className="p">
              {t(
                "Servono almeno due mesi di giornate raccontate per dire qualcosa di vero su come stai.",
              )}
            </div>
          </div>
        </div>
      </RailRight>
    </>
  );
}
