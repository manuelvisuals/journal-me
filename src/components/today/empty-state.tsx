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
};

export function EmptyState({
  onStartRecording,
  onWriteManually,
  writeFirst = false,
}: Props) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
      <h1
        className="text-center"
        style={{
          fontSize: 28,
          fontWeight: 650,
          lineHeight: 1.15,
          letterSpacing: "-0.025em",
          color: "var(--color-ink)",
          marginBottom: 14,
        }}
      >
        {t("Com'e andata oggi?")}
      </h1>
      <p
        className="text-center"
        style={{
          fontSize: 14,
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

      <button
        type="button"
        onClick={writeFirst ? onWriteManually : onStartRecording}
        aria-label={
          writeFirst ? t("Scrivi la giornata") : t("Inizia a registrare")
        }
        className="mic-big-btn"
      >
        {writeFirst ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="34"
            height="34"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="36"
            height="36"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        )}
      </button>

      {!writeFirst && (
        <button
          type="button"
          onClick={onWriteManually}
          className="jm-write-link"
        >
          {t("Preferisco scrivere a mano")}
        </button>
      )}
    </div>
  );
}
