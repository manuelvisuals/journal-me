"use client";

import { formatDecimal, formatSleep, shortWeekday } from "@/lib/format";
import type { Entry, Mood } from "@/lib/types";

type Props = {
  year: number;
  month: number;
  day: number;
  entry: Entry | null;
  isToday: boolean;
  loading?: boolean;
  onClick?: () => void;
};

const MOOD_EMOJI: Record<Mood, string> = {
  great: "\u{1F60A}",
  good: "\u{1F642}",
  neutral: "\u{1F610}",
  low: "\u{1F614}",
  bad: "\u{1F641}",
};

export function DayRow({
  year,
  month,
  day,
  entry,
  isToday,
  loading = false,
  onClick,
}: Props) {
  const date = new Date(year, month - 1, day);
  const weekday = shortWeekday(date);

  const classes = ["jm-day-row"];
  if (isToday) classes.push("is-today");
  if (entry) classes.push("is-filled");
  if (loading) classes.push("is-loading");

  const m = entry?.metrics ?? null;
  const goals = entry?.goals ?? [];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-busy={loading}
      onClick={loading ? undefined : onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick && !loading) {
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
            <div className="jm-day-meta">
              {m?.weightKg != null && (
                <span className="jm-meta-chip">
                  <span className="v">{formatDecimal(m.weightKg, 1)}</span> kg
                </span>
              )}
              {m?.sleepHours != null && (
                <span className="jm-meta-chip">
                  <span className="v">{formatSleep(m.sleepHours)}</span>
                </span>
              )}
              {m?.mood && (
                <span className="jm-meta-mood">{MOOD_EMOJI[m.mood]}</span>
              )}
              {goals.length > 0 && (
                <span className="jm-dots-mini">
                  {goals.map((g) => (
                    <span
                      key={g.label}
                      className={g.on ? "jm-dot-mini on" : "jm-dot-mini"}
                    />
                  ))}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="jm-day-empty">&mdash; giornata vuota &mdash;</div>
        )}
      </div>

      {loading && <span className="jm-day-spinner" aria-hidden="true" />}
    </div>
  );
}
