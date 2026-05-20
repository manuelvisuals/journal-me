"use client";

import { DayRow } from "@/components/mese/day-row";
import { dateKey, daysInMonth, todayISO } from "@/lib/format";
import type { Entry } from "@/lib/types";

type Props = {
  year: number;
  month: number; // 1-based
  entries: Entry[];
  onDayClick?: (year: number, month: number, day: number) => void;
};

export function MonthSection({ year, month, entries, onDayClick }: Props) {
  const total = daysInMonth(year, month);
  const today = todayISO();
  const todayParts = today.split("-").map(Number);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // Index entries by date for O(1) lookup, newest first.
  const byDate = new Map<string, Entry>();
  for (const e of entries) byDate.set(e.entryDate, e);

  // Days: newest at top. If current month, start at today and go down to 1.
  // If past month, start at last day and go down to 1. If future month (shouldn't
  // happen), nothing.
  const startDay = isCurrentMonth ? now.getDate() : total;
  const days: number[] = [];
  for (let d = startDay; d >= 1; d--) days.push(d);

  return (
    <section data-jm-month={`${year}-${String(month).padStart(2, "0")}`}>
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
            onClick={onDayClick ? () => onDayClick(year, month, d) : undefined}
          />
        );
      })}
    </section>
  );
}
