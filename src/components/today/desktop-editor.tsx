"use client";

/**
 * L'editor desktop (SPEC-v2 §5.3, mockup desktop-v1 §01): da lg in su la
 * colonna centrale E l'editor — niente overlay, si arriva su Oggi e si
 * scrive. Tipografia conforme al brandbook (cap. 03, "Body 17"):
 * font UI del tema, 17/400/1.6 — la deroga Spectral e stata proposta e
 * rifiutata da Manuel il 19 ago 2026. Caret ambra, placeholder serif
 * corsivo, nessuna toolbar: testo puro.
 *
 * Autosave (SPEC-v2 §6): 800ms dopo l'ultima battuta la bozza va in
 * IndexedDB. onDraftSaved riceve il timestamp SOLO se la scrittura e
 * riuscita — l'indicatore non deve mai dire "salvato" su un fallimento.
 * La bozza si cancella altrove (runSave in today-client), solo a
 * giornata salvata davvero.
 *
 * Scorciatoie locali del campo (§5.4): Cmd/Ctrl+S salva senza AI,
 * Cmd/Ctrl+Invio chiude la giornata (con AI dove disponibile). Il resto
 * (palette, ecc.) arriva con la PR 8.
 */

import { useEffect, useRef, useState } from "react";
import { clearDraft, saveDraft } from "@/lib/data/drafts";
import {
  SHORTCUT_EVENT,
  type EditorShortcut,
} from "@/components/desktop/use-shortcuts";
import { useT } from "@/lib/i18n";

type Props = {
  /** Data (YYYY-MM-DD) su cui scrive e su cui salva la bozza. */
  targetDate: string;
  initialText: string;
  /** Avviso discreto sopra il testo (es. bozza recuperata). */
  notice: string | null;
  /** true = esiste il percorso AI ("chiudi la giornata" elabora). */
  aiAvailable: boolean;
  saving: boolean;
  /** Mostra "annulla" quando c'e una giornata gia raccontata a cui tornare. */
  onCancel: (() => void) | null;
  onSaveOnly: (text: string) => void;
  onSaveAI: (text: string) => void;
  /** Conteggio parole per l'header ("218 parole"). */
  onWords: (words: number) => void;
  /** Timestamp dell'ultima bozza REALMENTE scritta su disco, o null. */
  onDraftSaved: (ts: number | null) => void;
};

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function DesktopEditor({
  targetDate,
  initialText,
  notice,
  aiAvailable,
  saving,
  onCancel,
  onSaveOnly,
  onSaveAI,
  onWords,
  onDraftSaved,
}: Props) {
  const t = useT();
  const [value, setValue] = useState<string>(initialText);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const latestRef = useRef<string>(initialText);
  const dirtyRef = useRef<boolean>(false);
  const isEmpty = value.trim().length === 0;

  const flushDraft = async (text: string) => {
    if (text.trim().length === 0) {
      await clearDraft(targetDate);
      onDraftSaved(null);
      return;
    }
    const ok = await saveDraft(targetDate, text);
    onDraftSaved(ok ? Date.now() : null);
  };

  const handleChange = (text: string) => {
    setValue(text);
    latestRef.current = text;
    dirtyRef.current = true;
    onWords(countWords(text));
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      dirtyRef.current = false;
      void flushDraft(latestRef.current);
    }, 800);
  };

  // Parole iniziali (bozza recuperata) + flush della bozza in sospeso se
  // il componente muore prima degli 800ms (navigazione via).
  useEffect(() => {
    onWords(countWords(latestRef.current));
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (dirtyRef.current && latestRef.current.trim().length > 0) {
        void saveDraft(targetDate, latestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (withAI: boolean) => {
    if (isEmpty || saving) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      dirtyRef.current = false;
    }
    (withAI && aiAvailable ? onSaveAI : onSaveOnly)(value);
  };

  // Cmd+S / Cmd+Invio arrivano anche quando il fuoco NON e nel textarea
  // (PR 8): use-shortcuts li rilancia come CustomEvent e qui si eseguono
  // con il testo corrente. submitRef evita di ri-registrare a ogni render.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    const onShortcut = (e: Event) => {
      const detail = (e as CustomEvent<EditorShortcut>).detail;
      if (detail === "save") submitRef.current(false);
      else if (detail === "saveAI") submitRef.current(true);
    };
    window.addEventListener(SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(SHORTCUT_EVENT, onShortcut);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      submit(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(true);
    }
  };

  return (
    <div className="jm-ed-wrap">
      {/* Cliccare ovunque nella colonna mette il fuoco nell'editor (§5.3). */}
      <div className="jm-ed-scroll" onClick={() => taRef.current?.focus()}>
        {notice && <div className="jm-ed-notice">{notice}</div>}
        <textarea
          ref={taRef}
          autoFocus
          className="jm-ed-ta"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          placeholder={t("Com'e andata oggi?")}
        />
      </div>

      <div className="jm-ed-foot">
        <div className="jm-ed-hint">
          {t("Bozza salvata in automatico")} . {"\u2318K"} {t("comandi")}
        </div>
        <div className="jm-ed-acts">
          {onCancel && (
            <button
              type="button"
              className="btn-ghost"
              onClick={onCancel}
              disabled={saving}
            >
              {t("annulla")}
            </button>
          )}
          {aiAvailable ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => submit(false)}
                disabled={isEmpty || saving}
              >
                {t("salva e basta")} <span className="jm-ed-k">{"\u2318S"}</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => submit(true)}
                disabled={isEmpty || saving}
              >
                {t("chiudi la giornata")}{" "}
                <span className="jm-ed-k">{"\u2318\u23CE"}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => submit(false)}
              disabled={isEmpty || saving}
            >
              {t("salva la giornata")}{" "}
              <span className="jm-ed-k">{"\u2318\u23CE"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
