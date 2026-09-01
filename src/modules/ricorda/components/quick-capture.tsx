"use client";

import { useRef, useState } from "react";
import { RecordingOverlay } from "@/modules/oggi";
import { openPremiumWall } from "@/modules/abbonamento";
import { useCan } from "@/lib/capabilities";
import { todayISO } from "@/lib/format";
import type { DataMode } from "@/lib/data/entries";
import type { RememberKind } from "@/lib/types";
import { t, useT } from "@/lib/i18n";

type Props = {
  mode: DataMode;
  defaultKind: RememberKind;
  onAdd: (text: string, kind: RememberKind) => void | Promise<void>;
};

const KIND_OPTIONS: { key: RememberKind; label: string }[] = [
  { key: "nota", label: "Nota" },
  { key: "persona", label: "Persona" },
  { key: "todo", label: "Todo" },
  { key: "luogo", label: "Luogo" },
  { key: "idea", label: "Idea" },
];

export function QuickCapture({ mode, defaultKind, onAdd }: Props) {
  const t = useT();
  // La voce e una capability come nel resto dell'app (SPEC-v2 §3.3): questo
  // mic apriva la registrazione senza nessun controllo, quindi in modalita
  // locale mandava l'audio a /api/transcribe-fallback e rompeva la promessa
  // "nemmeno una richiesta di rete". In gratis apre il muro premium; il
  // campo di testo resta li accanto ed e l'uscita gratuita.
  const canVoice = useCan("voice");
  const [text, setText] = useState<string>("");
  const [kind, setKind] = useState<RememberKind>(defaultKind);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [recorderOpen, setRecorderOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  // Ref guard against the rare double-fire race where two tap events arrive
  // in the same tick before submitting state has propagated through React.
  const submittingRef = useRef<boolean>(false);

  const handleVoiceStop = (transcript: string) => {
    setRecorderOpen(false);
    const clean = transcript.trim();
    if (!clean) return;
    // Append to existing text (or replace if empty) so the user can keep
    // typing on top of what they spoke.
    setText((prev) => (prev.trim() ? prev + " " + clean : clean));
  };

  // If the parent's defaultKind prop changes (filter switch), sync.
  // We use a derived approach: re-key in the parent if we want a hard reset.
  // For now we accept that local override sticks until the user reopens.

  const submit = async () => {
    if (submittingRef.current) return;
    // `clean` e non `t`: `t` e la funzione di traduzione.
    const clean = text.trim();
    if (!clean) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onAdd(clean, kind);
      setText("");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
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
          placeholder={t("Memo...")}
          aria-label={t("Cosa vuoi ricordare")}
        />
        <button
          type="button"
          className="jm-qc-kind"
          onClick={() => setPickerOpen((o) => !o)}
        >
          {labelOf(kind)}
        </button>
        <button
          type="button"
          className="jm-qc-mic"
          aria-label={t("Aggiungi con voce")}
          onClick={() => {
            if (!canVoice) {
              openPremiumWall("voice");
              return;
            }
            setRecorderOpen(true);
          }}
        >
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
        </button>
        <button
          type="submit"
          className="jm-qc-add"
          aria-label={t("Aggiungi")}
          disabled={!text.trim() || submitting}
          aria-busy={submitting}
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
              {t(o.label)}
            </button>
          ))}
        </div>
      )}

      {recorderOpen && canVoice && (
        <RecordingOverlay
          mode={mode}
          defaultDate={todayISO()}
          onStop={(transcript) => handleVoiceStop(transcript)}
          onCancel={() => setRecorderOpen(false)}
        />
      )}
    </div>
  );
}

function labelOf(k: RememberKind): string {
  return t(KIND_OPTIONS.find((o) => o.key === k)?.label ?? k);
}
