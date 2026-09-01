"use client";

import { useT } from "@/lib/i18n";

type Props = {
  onStartRecording: () => void;
  onWriteManually: () => void;
  /**
   * Modalita locale: la voce e una funzione cloud/AI, quindi l'ingresso
   * della giornata e la scrittura (mockup due-modalita §02). Il muro
   * premium vero e proprio arriva con la PR 10 (gating-ui).
   */
  writeFirst?: boolean;
  /**
   * L'uscita quieta, quando questa schermata e la pagina Record aperta dal
   * dock sopra una giornata gia raccontata: si torna da dove si e venuti.
   * Assente sulla giornata vuota, dove non c'e nessun "indietro".
   */
  onCancel?: () => void;
  /**
   * Il calendarietto della pagina Record (2 settembre 2026, richiesta di
   * Manuel): il giorno a cui va il racconto, visibile e cambiabile PRIMA
   * di aprire il microfono, non solo dentro l'ascolto. La schermata resta
   * stupida: riceve l'etichetta pronta e il tocco, il giorno lo tiene chi
   * la monta.
   */
  dataChip?: { label: React.ReactNode; onClick: () => void };
};

export function EmptyState({
  onStartRecording,
  onWriteManually,
  writeFirst = false,
  onCancel,
  dataChip,
}: Props) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
      {dataChip && (
        <div style={{ marginBottom: 26 }}>
          <button
            type="button"
            className="jm-date-chip"
            onClick={dataChip.onClick}
            aria-haspopup="dialog"
          >
            <svg
              className="icn"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {dataChip.label}
            <span className="chev">&#9662;</span>
          </button>
        </div>
      )}
      <h1
        className="text-center"
        style={{
          /* La voce del diario (mockup restyling §02, scelta di Manuel il
             1 settembre 2026): la domanda parla col SERIF DI PROSA del
             tema — e il diario a chiederti com'e andata, non un modulo.
             Peso leggero e corpo piu grande: un'apertura, non un'etichetta. */
          fontFamily: "var(--font-serif)",
          fontSize: "calc(31px * var(--jm-ui-scale))",
          fontWeight: 420,
          lineHeight: 1.18,
          letterSpacing: "-0.02em",
          color: "var(--color-ink)",
          marginBottom: 14,
        }}
      >
        {t("Com'e andata oggi?")}
      </h1>
      <p
        className="text-center"
        style={{
          fontSize: "calc(14px * var(--jm-ui-scale))",
          color: "var(--color-ink-muted)",
          marginBottom: 64,
          lineHeight: 1.55,
          maxWidth: 280,
          whiteSpace: "pre-line",
        }}
      >
        {/* Due righe con un a capo in mezzo: dove spezzare lo decide la
            traduzione, non un <br/> fisso pensato per l'italiano. */}
        {writeFirst
          ? t("Scrivi due righe.\nSenza pensarci troppo.")
          : t("Apri il microfono e racconta.\nSenza pensarci troppo.")}
      </p>

      {/* Due tasti pieni, come le card di /benvenuto (Manuel, 27 agosto
          2026): il microfono e la via maestra e si veste da primario, la
          scrittura e la via quieta e si veste da ghost. Sostituiscono il
          cerchione a doppio tocco e il link "preferisco scrivere a mano".
          In modalita scrittura-prima (locale) resta un tasto solo. */}
      <div style={{ width: "100%", maxWidth: 320, display: "grid", gap: 12 }}>
        {writeFirst ? (
          <button
            type="button"
            onClick={onWriteManually}
            className="btn-primary"
          >
            <IconaPenna />
            {t("Scrivi la giornata")}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onStartRecording}
              className="btn-primary"
            >
              <IconaMic />
              {t("Racconta a voce")}
            </button>
            <button
              type="button"
              onClick={onWriteManually}
              className="btn-ghost"
            >
              <IconaPenna />
              {t("Scrivi a mano")}
            </button>
          </>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="jm-write-link"
            style={{ justifySelf: "center" }}
          >
            {t("Annulla")}
          </button>
        )}
      </div>
    </div>
  );
}

function IconaMic() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function IconaPenna() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
