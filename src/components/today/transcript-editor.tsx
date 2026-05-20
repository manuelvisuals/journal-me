"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  initialTranscript: string;
  onSave: (newTranscript: string) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
};

/**
 * Full-screen modal to manually edit the transcript of an entry.
 * On save, the entry is re-processed by the AI to regenerate headline,
 * snippet, and macro-areas based on the corrected text.
 * Optionally exposes a destructive "Elimina giornata" action.
 */
export function TranscriptEditor({
  initialTranscript,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const [value, setValue] = useState<string>(initialTranscript);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const isDirty = value !== initialTranscript;
  const isEmpty = value.trim().length === 0;

  const handleDeleteClick = () => {
    if (!onDelete) return;
    if (window.confirm("Eliminare definitivamente questa giornata?")) {
      void onDelete();
    }
  };

  return (
    <div className="jm-editor-overlay" role="dialog" aria-modal="true">
      <div className="jm-editor-card">
        <div className="jm-editor-header">
          <span className="jm-editor-title">Modifica transcript</span>
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
              onClick={() => onSave(value)}
              disabled={!isDirty || isEmpty}
            >
              Salva
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className="jm-editor-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          placeholder="Trascrizione vuota."
        />

        <div className="jm-editor-footer-row">
          {onDelete ? (
            <button
              type="button"
              className="jm-editor-btn danger"
              onClick={handleDeleteClick}
            >
              Elimina giornata
            </button>
          ) : (
            <span />
          )}
          <span className="jm-editor-hint-inline">
            al salvataggio . headline e aree vengono rigenerate
          </span>
        </div>
      </div>
    </div>
  );
}
