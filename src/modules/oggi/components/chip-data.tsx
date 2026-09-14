"use client";

/**
 * La pastiglia con la data, quella che si tocca per cambiare giorno.
 *
 * Nata dentro manual-write.tsx (la scrittura a mano l'aveva per prima);
 * dal 14 settembre 2026 la usano anche la rilettura dopo la registrazione
 * e la modifica del transcript, cioe i due posti da cui si corregge un
 * giorno sbagliato. Stesso disegno e stessa classe: chi l'ha gia vista
 * una volta la riconosce, e non deve imparare due comandi per la stessa
 * cosa.
 */

import { compactDayDate, parseISODate, relativeDayLabel, todayISO } from "@/lib/format";

export function ChipData({
  iso,
  onClick,
}: {
  iso: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="jm-date-chip"
      style={{ marginTop: 6, whiteSpace: "nowrap" }}
      onClick={onClick}
      aria-haspopup="dialog"
    >
      {/* suppressHydrationWarning: "Oggi" e "Ieri" dipendono dall'orologio
          del dispositivo, e il server non ce l'ha. */}
      <span suppressHydrationWarning>
        <span style={{ color: "var(--color-ink)", fontWeight: 600 }}>
          {relativeDayLabel(parseISODate(iso), parseISODate(todayISO()))}
        </span>
        <span style={{ marginLeft: 5, color: "var(--color-ink-faint)" }}>
          {" · "}
          {compactDayDate(parseISODate(iso))}
        </span>
      </span>
      <span className="chev">&#9662;</span>
    </button>
  );
}
