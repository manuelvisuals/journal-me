"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  initialTranscript: string;
  onSave: (newTranscript: string) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Full-screen modal to manually edit the transcript of an entry.
 * On save, the entry is re-processed by the AI to regenerate headline,
 * snippet, and macro-areas based on the corrected text.
 */
export function TranscriptEditor({
  initialTranscript,
  onSave,
  onCancel,
}: Props) {
  const [value, setValue] = useState<string>(initialTranscript);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus the textarea once on mount (lazy initializer pattern not applicable
  // — we genuinely need a side effect on a DOM node).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    // Place cursor at the end so the user can immediately start editing/scrolling.
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const isDirty = value !== initialTranscript;
  const isEmpty = value.trim().length === 0;

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

        <div className="jm-editor-hint">
          al salvataggio . headline e aree vengono rigenerate
        </div>
      </div>
    </div>
  );
}
