"use client";

import { DayRow } from "@/modules/mese/components/day-row";
import {
  dateKey,
  daysInMonth,
  formatMonthTitle,
  nowAppParts,
  todayISO,
} from "@/lib/format";
import type { Entry } from "@/lib/types";

type Props = {
  year: number;
  month: number; // 1-based
  entries: Entry[];
  /** When true, render an inline "MESE YYYY" divider header at the top of
   *  this section. Suppressed for the first/most-recent month because the
   *  sticky page header already shows that label. */
  showHeader?: boolean;
  /** ISO date of the day currently navigating to its detail (shows a spinner). */
  loadingDate?: string | null;
  onDayClick?: (year: number, month: number, day: number) => void;
};

export function MonthSection({
  year,
  month,
  entries,
  showHeader = false,
  loadingDate = null,
  onDayClick,
}: Props) {
  const total = daysInMonth(year, month);
  const today = todayISO();
  const todayParts = today.split("-").map(Number);
  const now = nowAppParts();
  const isCurrentMonth = year === now.year && month === now.month;

  // Index entries by date for O(1) lookup, newest first.
  const byDate = new Map<string, Entry>();
  for (const e of entries) byDate.set(e.entryDate, e);

  // Days: newest at top. If current month, start at today and go down to 1.
  // If past month, start at last day and go down to 1. If future month (shouldn't
  // happen), nothing.
  const startDay = isCurrentMonth ? now.day : total;
  const days: number[] = [];
  for (let d = startDay; d >= 1; d--) days.push(d);

  return (
    <section data-jm-month={`${year}-${String(month).padStart(2, "0")}`}>
      {showHeader && (
        <div className="jm-month-section-header" suppressHydrationWarning>
          {formatMonthTitle(year, month)}
        </div>
      )}
      {days.map((d) => {
        const k = dateKey(year, month, d);
        const entry = byDate.get(k) ?? null;
        const isToday =
          year === todayParts[0] && month === todayParts[1] && d === todayParts[2];
        return (
          <DayRow
            key={k}
            year={year}
            month={month}
            day={d}
            entry={entry}
            isToday={isToday}
            loading={loadingDate === k}
            onClick={onDayClick ? () => onDayClick(year, month, d) : undefined}
          />
        );
      })}
    </section>
  );
}
