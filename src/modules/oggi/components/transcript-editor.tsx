"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { ChipData } from "@/modules/oggi/components/chip-data";
import { DatePickerPopover } from "@/modules/oggi/components/date-picker-popover";
import { FoglioSposta } from "@/modules/oggi/components/foglio-sposta";
import type { EsitoSposta } from "@/modules/oggi/sposta-giorno";

type Props = {
  initialTranscript: string;
  onSave: (newTranscript: string) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
  /**
   * La data della giornata aperta. Quando c'e — insieme a onSpostato — la
   * data diventa toccabile e il racconto si puo portare su un altro
   * giorno (14 settembre 2026). Senza, l'editor e esattamente quello di
   * prima: nessun chiamante e obbligato ad aggiornarsi.
   */
  date?: string;
  onSpostato?: (esito: EsitoSposta) => void;
  onError?: (messaggio: string) => void;
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
  date,
  onSpostato,
  onError,
}: Props) {
  const t = useT();
  const [value, setValue] = useState<string>(initialTranscript);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [calendario, setCalendario] = useState<boolean>(false);
  /* La destinazione scelta: finche e null il foglio di conferma non
     esiste. Si sposta SEMPRE passando di li, mai al tocco sul giorno. */
  const [destinazione, setDestinazione] = useState<string | null>(null);
  const spostabile = !!date && !!onSpostato;

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
    if (window.confirm(t("Eliminare definitivamente questa giornata?"))) {
      void onDelete();
    }
  };

  return (
    <div className="jm-editor-overlay" role="dialog" aria-modal="true">
      <div className="jm-editor-card">
        <div className="jm-editor-header">
          <div>
            <span className="jm-editor-title">{t("Modifica transcript")}</span>
            {spostabile ? (
              <div>
                <ChipData iso={date} onClick={() => setCalendario(true)} />
              </div>
            ) : null}
          </div>
          <div className="jm-editor-actions">
            <button
              type="button"
              className="jm-editor-btn cancel"
              onClick={onCancel}
            >
              {t("Annulla")}
            </button>
            {/* Spento se non hai cambiato niente: senza modifiche non c'e
                niente da ricalcolare, e rifare l'analisi a vuoto costerebbe
                soldi per riscrivere lo stesso risultato (regola del 21
                agosto 2026: il testo cambia -> si ricalcola tutto; il testo
                non cambia -> non parte niente). */}
            <button
              type="button"
              className="jm-editor-btn save"
              onClick={() => onSave(value)}
              disabled={!isDirty || isEmpty}
            >
              {t("Salva")}
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
          placeholder={t("Trascrizione vuota.")}
        />

        <div className="jm-editor-footer-row">
          {onDelete ? (
            <button
              type="button"
              className="jm-editor-btn danger"
              onClick={handleDeleteClick}
            >
              {t("Elimina giornata")}
            </button>
          ) : (
            <span />
          )}
          <span className="jm-editor-hint-inline">
            {t("al salvataggio . headline e aree vengono rigenerate")}
          </span>
        </div>
      </div>

      {spostabile && date ? (
        <DatePickerPopover
          open={calendario}
          selected={date}
          onSelect={(iso) => {
            setCalendario(false);
            /* Lo stesso giorno non e uno spostamento: si chiude e basta,
               senza aprire un foglio che poi non avrebbe niente da fare. */
            if (iso !== date) setDestinazione(iso);
          }}
          onClose={() => setCalendario(false)}
        />
      ) : null}

      {spostabile && date && destinazione ? (
        <FoglioSposta
          da={date}
          a={destinazione}
          /* Il testo com'e ADESSO nell'editor, correzioni comprese: vedi
             il commento in testa a foglio-sposta.tsx. */
          transcript={value}
          onAnnulla={() => setDestinazione(null)}
          onFatto={(esito) => {
            setDestinazione(null);
            onSpostato?.(esito);
          }}
          onErrore={(m) => {
            setDestinazione(null);
            onError?.(m);
          }}
        />
      ) : null}
    </div>
  );
}
