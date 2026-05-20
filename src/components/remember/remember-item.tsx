"use client";

import type { Remember, RememberKind } from "@/lib/types";

type Props = {
  remember: Remember;
  onDelete: () => void;
};

const KIND_LABEL_IT: Record<RememberKind, string> = {
  persona: "Persona",
  todo: "Todo",
  nota: "Nota",
  luogo: "Luogo",
  idea: "Idea",
};

function KindIcon({ kind }: { kind: RememberKind }) {
  switch (kind) {
    case "persona":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
        </svg>
      );
    case "todo":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "luogo":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "idea":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
      );
    case "nota":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
}

export function RememberItem({ remember, onDelete }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    // Long-press style: only delete if shift+click for now.
    if (e.shiftKey) {
      if (confirm("Eliminare?")) onDelete();
    }
  };

  return (
    <div className="jm-rem-item" onClick={handleClick}>
      <div className="jm-rem-icon">
        <KindIcon kind={remember.kind} />
      </div>
      <div className="jm-rem-body">
        <div className="jm-rem-text">{remember.text}</div>
        <div className="jm-rem-meta">
          <span className="kind">{KIND_LABEL_IT[remember.kind]}</span>
          <span>&middot;</span>
          {remember.source === "extracted" ? (
            <span className="src extracted">estratto da una giornata</span>
          ) : (
            <span>manuale</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="jm-rem-del"
        aria-label="Elimina"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Eliminare questo elemento?")) onDelete();
        }}
      >
        &times;
      </button>
    </div>
  );
}
