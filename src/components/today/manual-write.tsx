"use client";

import { useEffect, useRef, useState } from "react";
import { clearDraft, saveDraft } from "@/lib/data/drafts";
import { useT } from "@/lib/i18n";

type Props = {
  /** Data (YYYY-MM-DD) su cui va la bozza dell'autosave. */
  targetDate: string;
  /** Testo di partenza (bozza recuperata al mount di Oggi, SPEC-v2 §6). */
  initialValue?: string;
  /** Avviso discreto sopra il testo (es. "bozza non salvata, recuperata"). */
  notice?: string | null;
  /** Hand the typed text to the same review -> AI -> day flow as a recording. */
  onContinue: (text: string) => void;
  onCancel: () => void;
};

/**
 * Manual journaling entry point: when the user can't (or doesn't want to)
 * speak out loud, they type their day here. The text then follows the exact
 * same pipeline as a voice recording: review -> AI processing -> day.
 *
 * Autosave (SPEC-v2 §6): 800ms dopo l'ultima battuta la bozza va in
 * IndexedDB — chiudere l'app a meta frase non perde piu niente. La bozza
 * si cancella solo quando la giornata viene salvata con successo (lo fa
 * il flusso di salvataggio, non questo componente).
 */
export function ManualWrite({
  targetDate,
  initialValue,
  notice,
  onContinue,
  onCancel,
}: Props) {
  const t = useT();
  const [value, setValue] = useState<string>(initialValue ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const latestRef = useRef<string>(initialValue ?? "");
  const dirtyRef = useRef<boolean>(false);
  const isEmpty = value.trim().length === 0;

  const handleChange = (text: string) => {
    setValue(text);
    latestRef.current = text;
    dirtyRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      dirtyRef.current = false;
      if (latestRef.current.trim().length === 0) {
        void clearDraft(targetDate);
      } else {
        void saveDraft(targetDate, latestRef.current);
      }
    }, 800);
  };

  // Flush della bozza in sospeso se l'overlay si chiude prima degli 800ms.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (dirtyRef.current && latestRef.current.trim().length > 0) {
        void saveDraft(targetDate, latestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="jm-editor-overlay" role="dialog" aria-modal="true">
      <div className="jm-editor-card">
        <div className="jm-editor-header">
          <div>
            <div className="jm-editor-title">{t("Scrivi la tua giornata")}</div>
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
              {t("senza parlare a voce alta")}
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
              onClick={() => onContinue(value)}
              disabled={isEmpty}
            >
              {t("Continua")}
            </button>
          </div>
        </div>

        {notice && (
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 12.5,
              color: "var(--color-accent)",
              padding: "8px 0 0",
            }}
          >
            {notice}
          </div>
        )}

        <textarea
          ref={textareaRef}
          autoFocus
          className="jm-editor-textarea"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          placeholder={t("Oggi ho visto Mario e ho parlato con Luca al telefono. Chiuso il progetto al lavoro...")}
        />

        <div className="jm-editor-hint">
          {t("continua . poi rileggi e l'ai elabora la giornata")}
        </div>
      </div>
    </div>
  );
}
