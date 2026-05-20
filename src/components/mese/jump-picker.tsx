"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  currentYear: number;
  currentMonth: number; // 1-based
  /** Today, used to disable future months. */
  todayYear: number;
  todayMonth: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
};

const MONTHS_IT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

export function JumpPicker({
  open,
  currentYear,
  currentMonth,
  todayYear,
  todayMonth,
  onSelect,
  onClose,
}: Props) {
  const [pickerYear, setPickerYear] = useState<number>(currentYear);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="jm-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Seleziona mese"
    >
      <div className="jm-picker">
        <div className="jm-picker-year">
          <button
            type="button"
            className="nav"
            onClick={() => setPickerYear((y) => y - 1)}
            aria-label="Anno precedente"
          >
            &#8249;
          </button>
          <span className="y">{pickerYear}</span>
          <button
            type="button"
            className="nav"
            onClick={() => setPickerYear((y) => y + 1)}
            disabled={pickerYear >= todayYear}
            aria-label="Anno successivo"
            style={pickerYear >= todayYear ? { opacity: 0.3, cursor: "not-allowed" } : undefined}
          >
            &#8250;
          </button>
        </div>
        <div className="jm-picker-grid">
          {MONTHS_IT.map((label, i) => {
            const m = i + 1;
            const isFuture =
              pickerYear > todayYear ||
              (pickerYear === todayYear && m > todayMonth);
            const isCurrent = pickerYear === currentYear && m === currentMonth;
            const cls = ["jm-picker-cell"];
            if (isFuture) cls.push("future");
            if (isCurrent) cls.push("current");
            return (
              <button
                key={m}
                type="button"
                className={cls.join(" ")}
                disabled={isFuture}
                onClick={() => onSelect(pickerYear, m)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
