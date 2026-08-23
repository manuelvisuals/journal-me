"use client";

/**
 * Il foglio "aggiungi a questa giornata" (mockup
 * design/mockups/testo-e-giorno.html §03/§04, approvato il 20 agosto 2026).
 *
 * Perche esiste: da /giorno non si poteva scrivere. Una giornata vuota
 * diceva "vai su Oggi", che e un vicolo cieco — e una giornata gia
 * raccontata non aveva nessun modo di ricevere una riga in piu. Il diario
 * di ieri sera ti torna in mente stamattina, e stamattina l'app non
 * sapeva dove metterlo.
 *
 * Tre voci, e nessuna e nuova sotto il cofano:
 *  - "Scrivi altro" apre lo stesso ManualWrite di Oggi e passa da
 *    saveRecording con la data forzata: l'aggiunta in coda al transcript
 *    esiste gia (`existing.transcript + SEGMENT_SEP + nuovo`);
 *  - "Racconta a voce" apre lo stesso RecordingOverlay con defaultDate;
 *  - "Salva in Ricorda" monta QuickCapture, lo stesso della schermata
 *    Ricorda.
 *
 * LA VOCE NON C'E IN GRATIS, e non come tasto spento con la targhetta
 * "Premium": quello e solo un modo elegante di dire di no. Chi non ce l'ha
 * vede due voci e nessun buco (SPEC-v2 §3.3, l'uscita gratuita).
 */

import { useState } from "react";
import { ManualWrite } from "@/components/today/manual-write";
import { RecordingOverlay } from "@/components/today/recording-overlay";
import { QuickCapture } from "@/components/remember/quick-capture";
import { useCan } from "@/lib/capabilities";
import { addRemember } from "@/lib/data/remembers";
import { saveRecording } from "@/lib/actions/save-recording";
import { compactDayDate, formatDate, parseISODate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import type { DataMode } from "@/lib/data/entries";
import type { Entry, RememberKind } from "@/lib/types";

type Props = {
  mode: DataMode;
  /** La data della giornata aperta (YYYY-MM-DD). Non diventa mai "oggi". */
  date: string;
  /** Chiuso il foglio con una giornata salvata: il chiamante aggiorna. */
  onSaved: (entry: Entry) => void;
  onError: (message: string) => void;
  /**
   * Su una giornata VUOTA il tasto e l'unica cosa sullo schermo e dice il
   * giorno per nome ("racconta il 19 agosto"): serve a togliere l'unico
   * dubbio di chi sta per scrivere, cioe se finira su oggi. Su una
   * giornata gia raccontata il giorno e scritto due righe sopra e
   * ripeterlo sarebbe rumore.
   */
  variant?: "add" | "empty";
};

type Sheet = "closed" | "menu" | "write" | "record" | "remember";

export function AddToDay({
  mode,
  date,
  onSaved,
  onError,
  variant = "add",
}: Props) {
  const t = useT();
  const canVoice = useCan("voice");
  const [sheet, setSheet] = useState<Sheet>("closed");
  const [saving, setSaving] = useState<boolean>(false);

  const dayLabel = compactDayDate(parseISODate(date));
  const dayName = longDayName(parseISODate(date));

  const commit = async (
    text: string,
    durationSeconds: number,
    // La registrazione ha il suo selettore di data: se l'utente la sposta,
    // vince lui. Senza questo parametro il foglio riporterebbe di forza
    // tutto su questa giornata, ignorando una scelta appena fatta.
    targetDate: string = date,
  ) => {
    const clean = text.trim();
    if (!clean || saving) return;
    setSaving(true);
    // Il foglio si chiude SUBITO: da qui in poi a parlare e l'avviso in
    // basso. Tenere aperto un editor congelato per tre secondi e il modo
    // piu sicuro di far credere che non stia succedendo niente.
    setSheet("closed");
    toast.loading(t("Salvo nella giornata..."));
    try {
      // skipSplit: la data l'ha scelta l'utente aprendo questa schermata.
      // Senza, una frase come "ieri" spostava il testo su un altro giorno
      // e qui non compariva niente (bug del 21 agosto 2026).
      const saved = await saveRecording({
        transcript: clean,
        defaultDate: targetDate,
        durationSeconds,
        skipSplit: true,
      });
      const forThisDay = saved.find((e) => e.entryDate === date);
      if (forThisDay) {
        onSaved(forThisDay);
        toast.ok(t("Aggiunto alla giornata"));
      } else if (saved.length > 0) {
        // Puo succedere solo se l'utente ha spostato la data nel
        // registratore: allora il testo e su un ALTRO giorno, ed e giusto
        // dirlo invece di lasciare questa schermata immutata e muta.
        toast.ok(
          t("Salvato sul {giorno}", {
            giorno: compactDayDate(parseISODate(saved[0].entryDate)),
          }),
        );
      } else {
        toast.error(t("Non sono riuscito a salvare. Riprova."));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Errore nel salvataggio");
      onError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemember = async (text: string, kind: RememberKind) => {
    setSheet("closed");
    toast.loading(t("Salvo in Ricorda..."));
    try {
      await addRemember(mode, text, kind);
      toast.ok(t("Salvato in Ricorda"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Errore nel salvataggio");
      onError(msg);
      toast.error(msg);
    }
  };

  return (
    <>
      <button
        type="button"
        className={variant === "empty" ? "jm-day-add empty" : "jm-day-add"}
        onClick={() => setSheet("menu")}
        disabled={saving}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {saving
          ? t("Salvo...")
          : variant === "empty"
            ? t("Racconta il {giorno}", { giorno: dayName })
            : t("Aggiungi a questa giornata")}
      </button>

      {sheet === "menu" && (
        <div
          className="jm-sheet-scrim"
          role="dialog"
          aria-modal="true"
          aria-label={t("Aggiungi a questa giornata")}
          onClick={() => setSheet("closed")}
        >
          <div className="jm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="jm-sheet-grip" aria-hidden="true" />

            <button
              type="button"
              className="jm-sheet-row"
              onClick={() => setSheet("write")}
            >
              <span className="jm-sheet-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </span>
              <span className="jm-sheet-txt">
                <span className="jm-sheet-t">{t("Scrivi altro")}</span>
                <span className="jm-sheet-d">
                  {t("Si aggiunge in fondo a quello che c'e gia")}
                </span>
              </span>
            </button>

            {canVoice && (
              <button
                type="button"
                className="jm-sheet-row"
                onClick={() => setSheet("record")}
              >
                <span className="jm-sheet-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="3" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </span>
                <span className="jm-sheet-txt">
                  <span className="jm-sheet-t">{t("Racconta a voce")}</span>
                  <span className="jm-sheet-d">
                    {t("Con la data del {giorno} gia impostata", { giorno: dayLabel })}
                  </span>
                </span>
              </button>
            )}

            <button
              type="button"
              className="jm-sheet-row"
              onClick={() => setSheet("remember")}
            >
              <span className="jm-sheet-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
                </svg>
              </span>
              <span className="jm-sheet-txt">
                <span className="jm-sheet-t">{t("Salva in Ricorda")}</span>
                <span className="jm-sheet-d">
                  {t("Una persona, un posto, un'idea di quel giorno")}
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {sheet === "remember" && (
        <div
          className="jm-sheet-scrim"
          role="dialog"
          aria-modal="true"
          aria-label={t("Salva in Ricorda")}
          onClick={() => setSheet("closed")}
        >
          <div className="jm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="jm-sheet-grip" aria-hidden="true" />
            <div className="jm-sheet-head">{t("Salva in Ricorda")}</div>
            <QuickCapture
              mode={mode}
              defaultKind="nota"
              onAdd={(text, kind) => handleRemember(text, kind)}
            />
          </div>
        </div>
      )}

      {sheet === "write" && (
        <ManualWrite
          targetDate={date}
          onContinue={(text) => void commit(text, 0)}
          onCancel={() => setSheet("closed")}
        />
      )}

      {sheet === "record" && canVoice && (
        <RecordingOverlay
          mode={mode}
          defaultDate={date}
          onStop={(transcript, seconds, target) =>
            void commit(transcript, seconds, target)
          }
          onCancel={() => setSheet("closed")}
        />
      )}
    </>
  );
}

/** "19 agosto" — giorno e mese per esteso, nella lingua scelta. */
function longDayName(d: Date): string {
  return formatDate(d, { day: "numeric", month: "long" });
}
