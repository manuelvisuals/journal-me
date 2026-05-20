"use client";

type Props = {
  onStartRecording: () => void;
};

export function EmptyState({ onStartRecording }: Props) {
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
        Com&apos;e andata oggi?
      </h1>
      <p
        className="text-center"
        style={{
          fontSize: 14,
          color: "var(--color-ink-muted)",
          marginBottom: 64,
          lineHeight: 1.55,
          maxWidth: 280,
        }}
      >
        Apri il microfono e racconta.
        <br />
        Senza pensarci troppo.
      </p>

      <button
        type="button"
        onClick={onStartRecording}
        aria-label="Inizia a registrare"
        className="mic-big-btn"
      >
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
      </button>
    </div>
  );
}
