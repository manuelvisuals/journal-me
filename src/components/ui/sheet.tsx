"use client";

/**
 * Il foglio dal basso — la primitiva di scheletro.
 *
 * Non e nato qui: e il foglio di "Aggiungi a questa giornata" (modulo
 * Oggi, add-to-day.tsx), promosso a scheletro il 28 agosto 2026 per la
 * porta dell'account (mockup porta-account §03, tranello 2). Il CSS
 * jm-sheet-* vive in src/styles/base.css, spostato verbatim: velo
 * sfocato, maniglia, righe da 58px, max-width 440px, padding per la
 * safe-area dell'iPhone. Chi ha bisogno di un foglio passa DA QUI: un
 * secondo foglio disegnato da capo e esattamente il difetto che questa
 * primitiva esiste per impedire.
 *
 * L'API e volutamente piccola: il velo che chiude al tocco, il foglio
 * che ferma il click, la maniglia. Le righe dentro sono contenuto dei
 * clienti (classi jm-sheet-row / -ic / -txt / -t / -d, anche loro in
 * base.css). Esc lo gestisce il cliente se gli serve: un foglio da
 * telefono si chiude col pollice, non con la tastiera.
 */

export function Sheet({
  label,
  onClose,
  children,
}: {
  /** L'aria-label del dialogo: cosa E questo foglio. */
  label: string;
  /** Chiamata dal tocco sul velo. */
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="jm-sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className="jm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="jm-sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
