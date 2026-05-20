"use client";

import {
  compactDayDate,
  fullWeekday,
  parseISODate,
  todayISO,
} from "@/lib/format";

type Props = {
  open: boolean;
  selected: string; // YYYY-MM-DD
  onSelect: (dateISO: string) => void;
  onClose: () => void;
};

const RECENT_DAYS_COUNT = 6;

function recentDays(): { iso: string; label: string; meta: string }[] {
  const today = parseISODate(todayISO());
  const out = [];
  for (let i = 0; i < RECENT_DAYS_COUNT; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let label: string;
    if (i === 0) label = "Oggi";
    else if (i === 1) label = "Ieri";
    else label = fullWeekday(d);
    out.push({ iso, label, meta: compactDayDate(d) });
  }
  return out;
}

export function DatePickerPopover({ open, selected, onSelect, onClose }: Props) {
  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const days = recentDays();

  return (
    <div
      onClick={handleBackdropClick}
      className="jm-date-pop"
      role="dialog"
      aria-modal="true"
      aria-label="Seleziona data"
    >
      <div className="jm-date-pop-card">
        {days.map((d) => {
          const isSel = d.iso === selected;
          const cls = ["jm-date-row"];
          if (isSel) cls.push("selected");
          return (
            <button
              key={d.iso}
              type="button"
              className={cls.join(" ")}
              onClick={() => onSelect(d.iso)}
            >
              <span className="pr-label">{d.label}</span>
              <span className="pr-meta">{d.meta}</span>
            </button>
          );
        })}
        <div className="jm-date-divider" />
        <button
          type="button"
          className="jm-date-row other"
          disabled
          style={{ opacity: 0.45, cursor: "not-allowed" }}
        >
          <span className="pr-label">Altra data...</span>
          <span className="pr-meta">&#8250;</span>
        </button>
      </div>
    </div>
  );
}
