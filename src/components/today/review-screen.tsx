"use client";

import { useRef, useState } from "react";
import { formatDurationMmSs } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Props = {
  initialTranscript: string;
  durationSeconds: number;
  targetDate: string;
  onConfirm: (finalTranscript: string) => void;
  onCancel: () => void;
};

/**
 * Shown after the user stops recording, BEFORE the AI processing.
 * Lets the user re-read and correct the transcript (typos, mis-transcribed
 * proper names) before headline/snippet/areas are generated.
 */
export function ReviewScreen({
  initialTranscript,
  durationSeconds,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const [value, setValue] = useState<string>(initialTranscript);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEmpty = value.trim().length === 0;

  return (
    <div className="jm-editor-overlay" role="dialog" aria-modal="true">
      <div className="jm-editor-card">
        <div className="jm-editor-header">
          <div>
            <div className="jm-editor-title">{t("Rileggi prima di processare")}</div>
            <div
              style={{
                fontSize: "calc(11px * var(--jm-ui-scale))",
                fontWeight: 600,
                color: "var(--color-ink-faint)",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {formatDurationMmSs(durationSeconds)} .{" "}
              {t("correggi nomi e parole")}
            </div>
          </div>
          <div className="jm-editor-actions">
            <button
              type="button"
              className="jm-editor-btn cancel"
              onClick={onCancel}
            >
              {t("Annulla")}
            </button>
            <button
              type="button"
              className="jm-editor-btn save"
              onClick={() => onConfirm(value)}
              disabled={isEmpty}
            >
              {t("Conferma")}
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          autoFocus
          className="jm-editor-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => {
            // place cursor at end, not select-all (user might want to scroll
            // and edit specific words).
            const len = e.currentTarget.value.length;
            e.currentTarget.setSelectionRange(len, len);
          }}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          placeholder={t("Trascrizione vuota.")}
        />

        <div className="jm-editor-hint">
          {t("conferma . l'ai genera headline e aree macro sul testo corretto")}
        </div>
      </div>
    </div>
  );
}
