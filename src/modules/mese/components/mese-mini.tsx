"use client";

/**
 * Il mese intero in una schermata, sul telefono (mockup
 * design/mockups/mese-griglia-mobile.html, approvato da Manuel il 23
 * agosto 2026: proposta 3 con i colori dell'umore).
 *
 * Un quadratino per giorno, sette per riga, partendo dal lunedi. Il colore
 * del quadratino e l'umore di quella giornata (cinque gradini, dal grigio
 * spento all'ambra piena); i giorni passati senza racconto restano un
 * contorno tratteggiato; i futuri sono smorzati.
 *
 * Il tocco NON porta via: seleziona il giorno e ne mostra il titolo nella
 * riga sotto la griglia. Da li si apre la giornata (o si va a raccontarla,
 * se manca). Un secondo tocco sullo stesso quadratino apre direttamente.
 * E' quello che la griglia da sola non sa fare: i titoli sono il motivo per
 * cui la lista esiste, e cosi restano raggiungibili senza scorrere.
 */

import { useState } from "react";
import { daysInMonth, shortWeekday } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Entry, Mood } from "@/lib/types";

type Today = { year: number; month: number; day: number };

type Props = {
  year: number;
  month: number; // 1-based
  entries: Entry[];
  today: Today;
  /** Apre la giornata: piena o vuota, la schermata e la stessa. */
  onDayClick: (iso: string) => void;
};

/** Umore -> gradino di colore. Cinque valori, come metrics.mood. */
const MOOD_STEP: Record<Mood, number> = {
  bad: 1,
  low: 2,
  neutral: 3,
  good: 4,
  great: 5,
};

const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

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
  for (const e of entries) byDay.set(Number(e.entryDate.slice(8, 10)), e);

  const total = daysInMonth(year, month);
  // getDay(): 0=domenica; la griglia parte dal lunedi.
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const afterToday = (d: number) =>
    year > today.year ||
    (year === today.year &&
      (month > today.month || (month === today.month && d > today.day)));

  const cells: Cell[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({
      key: `p${i}`,
      day: 0,
      kind: "out",
      isToday: false,
      iso: null,
      entry: null,
    });
  }
  for (let d = 1; d <= total; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const entry = byDay.get(d) ?? null;
    cells.push({
      key: iso,
      day: d,
      kind: afterToday(d) ? "future" : entry ? "full" : "empty",
      isToday:
        year === today.year && month === today.month && d === today.day,
      iso,
      entry,
    });
  }
  return cells;
}

export function MeseMini({ year, month, entries, today, onDayClick }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<number | null>(null);
  const cells = buildCells(year, month, entries, today);
  const sel = cells.find((c) => c.day === selected && c.kind !== "out") ?? null;

  const open = (iso: string | null) => {
    if (iso) onDayClick(iso);
  };

  return (
    <section className="jm-mese-mini" data-jm-month={`${year}-${String(month).padStart(2, "0")}`}>
      <div className="jm-mese-mini-wk" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w}>{t(w)}</div>
        ))}
      </div>

      <div className="jm-mese-mini-grid">
        {cells.map((c) => {
          if (c.kind === "out") {
            return <div key={c.key} className="jm-mese-mini-c out" aria-hidden="true" />;
          }
          const mood = c.entry?.metrics?.mood ?? null;
          const cls = [
            "jm-mese-mini-c",
            c.kind,
            mood ? `m${MOOD_STEP[mood]}` : "",
            c.kind === "full" && !mood ? "nomood" : "",
            c.isToday ? "today" : "",
            c.day === selected ? "sel" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={c.key}
              type="button"
              className={cls}
              aria-pressed={c.day === selected}
              onClick={() => {
                // Gia selezionato: il secondo tocco apre.
                if (c.day === selected) open(c.iso);
                else setSelected(c.day);
              }}
            >
              <span className="n">{c.day}</span>
            </button>
          );
        })}
      </div>

      {/* La riga sotto: il titolo del giorno scelto, e la porta per aprirlo.
          Quando non hai ancora scelto niente non e vuota, spiega il gesto:
          una riga muta sembrerebbe un pezzo rotto. */}
      {sel ? (
        <button
          type="button"
          className="jm-mese-mini-prev"
          onClick={() => open(sel.iso)}
        >
          <span className="d">
            <span className="dn">{sel.day}</span>
            <span className="dw">
              {shortWeekday(new Date(year, month - 1, sel.day))}
            </span>
          </span>
          <span className="x">
            <span className={sel.entry ? "h" : "h vuota"}>
              {sel.entry
                ? (sel.entry.headline ?? sel.entry.snippet ?? t("vuota"))
                : t("non raccontato")}
            </span>
            <span className="a">
              {sel.entry ? t("apri la giornata") : t("racconta questo giorno")}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </span>
        </button>
      ) : (
        <div className="jm-mese-mini-hint">
          {t("Tocca un giorno per vederne il titolo.")}
        </div>
      )}
    </section>
  );
}
