"use client";

/**
 * I mattoni di Impostazioni (mockup design/mockups/impostazioni.html §03).
 *
 * La regola del disegno approvato: OGNI riga dice la cosa e il suo valore
 * attuale. Chi arriva qui non deve aprire quattro schermate per sapere che
 * tema ha o quanti obiettivi tiene accesi — lo legge di lato. Quello che ha
 * bisogno di spazio (obiettivi, temi) si apre in un pannello suo; quello che
 * sta in una riga resta in linea (chiaro/scuro).
 *
 * Bersagli: la riga e alta almeno 56px, ben oltre i 44px del brandbook
 * cap. 05. Le righe non cliccabili sono `static` e non sono <button>, cosi
 * la tastiera non ci si ferma sopra per niente.
 */

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function SetGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="jm-st-group">
      <div className="jm-st-gl">{label}</div>
      <div className="jm-st-box">{children}</div>
    </section>
  );
}

function Chevron() {
  return (
    <svg
      className="jm-st-chev"
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

type RowProps = {
  title: string;
  desc?: string;
  /** Il valore attuale, a destra del titolo. */
  value?: ReactNode;
  /** Se c'e, la riga e un bottone. */
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Slot a destra al posto di valore+chevron (es. il segmented). */
  control?: ReactNode;
  /** Chevron: di default c'e quando la riga porta da qualche parte. */
  chevron?: boolean;
};

export function SetRow({
  title,
  desc,
  value,
  onClick,
  danger,
  disabled,
  control,
  chevron,
}: RowProps) {
  const inner = (
    <>
      <span className="jm-st-grow">
        <span className="jm-st-t">{title}</span>
        {desc && <span className="jm-st-d">{desc}</span>}
      </span>
      {value != null && <span className="jm-st-val">{value}</span>}
      {control}
      {(chevron ?? (!!onClick && !control)) && <Chevron />}
    </>
  );

  if (!onClick) {
    return <div className="jm-st-row static">{inner}</div>;
  }
  return (
    <button
      type="button"
      className={`jm-st-row${danger ? " danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {inner}
    </button>
  );
}

/** L'intestazione di un pannello: indietro + titolo. */
export function PanelHead({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const t = useT();
  return (
    <header className="jm-col-head jm-st-phead">
      <button
        type="button"
        className="jm-st-back"
        onClick={onBack}
        aria-label={t("Torna a Impostazioni")}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h1 className="jm-st-h1">{title}</h1>
    </header>
  );
}
