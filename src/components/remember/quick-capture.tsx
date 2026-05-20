"use client";

import { useState } from "react";
import type { RememberKind } from "@/lib/types";

type Props = {
  defaultKind: RememberKind;
  onAdd: (text: string, kind: RememberKind) => void | Promise<void>;
};

const KIND_OPTIONS: { key: RememberKind; label: string }[] = [
  { key: "nota", label: "Nota" },
  { key: "persona", label: "Persona" },
  { key: "libro", label: "Libro" },
  { key: "todo", label: "Todo" },
  { key: "luogo", label: "Luogo" },
  { key: "idea", label: "Idea" },
];

export function QuickCapture({ defaultKind, onAdd }: Props) {
  const [text, setText] = useState<string>("");
  const [kind, setKind] = useState<RememberKind>(defaultKind);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  // If the parent's defaultKind prop changes (filter switch), sync.
  // We use a derived approach: re-key in the parent if we want a hard reset.
  // For now we accept that local override sticks until the user reopens.

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    await onAdd(t, kind);
    setText("");
  };

  return (
    <div className="jm-qc-bar">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="jm-qc-card"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ricorda..."
          aria-label="Cosa vuoi ricordare"
        />
        <button
          type="button"
          className="jm-qc-kind"
          onClick={() => setPickerOpen((o) => !o)}
        >
          {labelOf(kind)}
        </button>
        <button
          type="submit"
          className="jm-qc-add"
          aria-label="Aggiungi"
          disabled={!text.trim()}
        >
          +
        </button>
      </form>

      {pickerOpen && (
        <div className="jm-qc-kind-pop">
          {KIND_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={o.key === kind ? "row selected" : "row"}
              onClick={() => {
                setKind(o.key);
                setPickerOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function labelOf(k: RememberKind): string {
  return KIND_OPTIONS.find((o) => o.key === k)?.label ?? k;
}
