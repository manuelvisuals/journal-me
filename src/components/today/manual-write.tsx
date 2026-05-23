"use client";

import { useRef, useState } from "react";

type Props = {
  /** Hand the typed text to the same review -> AI -> day flow as a recording. */
  onContinue: (text: string) => void;
  onCancel: () => void;
};

/**
 * Manual journaling entry point: when the user can't (or doesn't want to)
 * speak out loud, they type their day here. The text then follows the exact
 * same pipeline as a voice recording: review -> AI processing -> day.
 */
export function ManualWrite({ onContinue, onCancel }: Props) {
  const [value, setValue] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isEmpty = value.trim().length === 0;

  return (
    <div className="jm-editor-overlay" role="dialog" aria-modal="true">
      <div className="jm-editor-card">
        <div className="jm-editor-header">
          <div>
            <div className="jm-editor-title">Scrivi la tua giornata</div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-ink-faint)",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              senza parlare a voce alta
            </div>
          </div>
          <div className="jm-editor-actions">
            <button
              type="button"
              className="jm-editor-btn cancel"
              onClick={onCancel}
            >
              Annulla
            </button>
            <button
              type="button"
              className="jm-editor-btn save"
              onClick={() => onContinue(value)}
              disabled={isEmpty}
            >
              Continua
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          autoFocus
          className="jm-editor-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          placeholder="Oggi ho visto Mario e ho parlato con Luca al telefono. Chiuso il progetto al lavoro..."
        />

        <div className="jm-editor-hint">
          continua . poi rileggi e l&apos;ai elabora la giornata
        </div>
      </div>
    </div>
  );
}
