"use client";

import { useState } from "react";
import { shortMonthAbbr } from "@/lib/format";
import { useT } from "@/lib/i18n";

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

// Le abbreviazioni dei mesi non sono piu scritte a mano: le da
// shortMonthAbbr(), che segue la lingua scelta ("Gen" / "Jan").
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function JumpPicker({
  open,
  currentYear,
  currentMonth,
  todayYear,
  todayMonth,
  onSelect,
  onClose,
}: Props) {
  const t = useT();
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
      aria-label={t("Seleziona mese")}
    >
      <div className="jm-picker">
        <div className="jm-picker-year">
          <button
            type="button"
            className="nav"
            onClick={() => setPickerYear((y) => y - 1)}
            aria-label={t("Anno precedente")}
          >
            &#8249;
          </button>
          <span className="y">{pickerYear}</span>
          <button
            type="button"
            className="nav"
            onClick={() => setPickerYear((y) => y + 1)}
            disabled={pickerYear >= todayYear}
            aria-label={t("Anno successivo")}
            style={pickerYear >= todayYear ? { opacity: 0.3, cursor: "not-allowed" } : undefined}
          >
            &#8250;
          </button>
        </div>
        <div className="jm-picker-grid">
          {MONTH_NUMBERS.map((m) => {
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
                {shortMonthAbbr(pickerYear, m)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
