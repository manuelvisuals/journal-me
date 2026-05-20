"use client";

import { formatDecimal, formatSleep, shortWeekday } from "@/lib/format";
import type { Entry } from "@/lib/types";

type Props = {
  year: number;
  month: number; // 1-based
  day: number;
  entry: Entry | null;
  isToday: boolean;
  onClick?: () => void;
};

// MVP fake metrics — deterministic per date so they don't flicker between
// renders. Will be replaced when metrics persistence lands.
const FAKE_MOODS = ["\u{1F60A}", "\u{1F642}", "\u{1F610}", "\u{1F614}", "\u{1F60C}"];

function hashDate(dateISO: string): number {
  let h = 0;
  for (let i = 0; i < dateISO.length; i++) {
    h = (h * 31 + dateISO.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function fakeMetricsFor(dateISO: string) {
  const h = hashDate(dateISO);
  return {
    weightKg: 78 + ((h % 30) / 10), // 78.0 .. 80.9
    sleepHours: 6 + ((Math.floor(h / 30) % 35) / 10), // 6.0 .. 9.4
    mood: FAKE_MOODS[h % FAKE_MOODS.length],
    dots: Array.from({ length: 6 }, (_, i) => ((h >> i) & 1) === 1),
  };
}

export function DayRow({ year, month, day, entry, isToday, onClick }: Props) {
  const date = new Date(year, month - 1, day);
  const weekday = shortWeekday(date);
  const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const classes = ["jm-day-row"];
  if (isToday) classes.push("is-today");
  if (entry) classes.push("is-filled");

  const fake = entry ? fakeMetricsFor(dateISO) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={classes.join(" ")}
    >
      <div className="jm-day-num">
        <div className="n">{day}</div>
        <div className="wd">{weekday}</div>
      </div>

      <div className="jm-day-body">
        {entry ? (
          <>
            <div className="jm-day-headline">
              {entry.headline ?? entry.snippet ?? entry.transcript.slice(0, 120)}
            </div>
            {fake && (
              <div className="jm-day-meta">
                <span className="jm-meta-chip">
                  <span className="v">{formatDecimal(fake.weightKg, 1)}</span> kg
                </span>
                <span className="jm-meta-chip">
                  <span className="v">{formatSleep(fake.sleepHours)}</span>
                </span>
                <span className="jm-meta-mood">{fake.mood}</span>
                <span className="jm-dots-mini">
                  {fake.dots.map((on, i) => (
                    <span
                      key={i}
                      className={on ? "jm-dot-mini on" : "jm-dot-mini"}
                    />
                  ))}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="jm-day-empty">&mdash; giornata vuota &mdash;</div>
        )}
      </div>
    </div>
  );
}
