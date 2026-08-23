"use client";

/**
 * Il titolo della giornata, e la possibilita di riscriverlo a mano.
 *
 * Regola, decisa da Manuel il 22 agosto 2026: appena lo scrivi tu, il titolo
 * diventa TUO e l'AI non lo tocca piu, nemmeno quando riscrivi tutta la
 * giornata e l'analisi riparte da zero. Non c'e nessuna strada indietro
 * dall'app — la targhetta "tuo" e una targhetta, non un bottone. Il mockup
 * ne prevedeva una ("rifallo tu, AI"), ed e stata tolta di proposito: il
 * titolo e la prima cosa che rileggi fra sei mesi, e se hai deciso come si
 * chiama quella giornata non deve poterlo cambiare nessuno, nemmeno un tocco
 * distratto sulla targhetta.
 *
 * Il blocco vive sul database (entries.headline_locked, migrazione 012), non
 * qui: e lo store che, a giornata bloccata, smette di scrivere headline.
 */

import { useEffect, useRef, useState } from "react";
import { saveHeadline } from "@/lib/data/entries";
import type { DataMode } from "@/lib/data/entries";
import { useT } from "@/lib/i18n";
import type { Entry } from "@/lib/types";

type Props = {
  headline?: string | null;
  /** Gia riscritto a mano: mostra la targhetta, e l'AI lo lascia stare. */
  locked?: boolean;
  dateISO: string;
  mode: DataMode;
  onSaved: (entry: Entry) => void;
  onError?: (message: string) => void;
};

export function HeadlineEditable({
  headline,
  locked = false,
  dateISO,
  mode,
  onSaved,
  onError,
}: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  // Il salvataggio parte sia da Invio sia dal blur. Senza questa guardia,
  // Invio salva e poi il blur che segue salva una seconda volta.
  const doneRef = useRef(false);

  const testo = (headline ?? "").trim();
  const hasHeadline = testo.length > 0;

  useEffect(() => {
    if (!editing) return;
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    autoGrow(el);
  }, [editing]);

  function apri() {
    if (saving) return;
    doneRef.current = false;
    setDraft(testo);
    setEditing(true);
  }

  async function conferma() {
    if (doneRef.current) return;
    doneRef.current = true;
    const nuovo = draft.trim().replace(/\s+/g, " ");
    // Titolo svuotato o identico: non e una modifica, e non deve bloccare
    // niente. Chi cancella tutto sta rinunciando, non sta scrivendo.
    if (nuovo.length === 0 || nuovo === testo) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setEditing(false);
    try {
      const entry = await saveHeadline(mode, dateISO, nuovo);
      onSaved(entry);
    } catch (e) {
      onError?.(
        e instanceof Error ? e.message : t("non sono riuscito a salvare il titolo"),
      );
    } finally {
      setSaving(false);
    }
  }

  function annulla() {
    doneRef.current = true;
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="jm-fv-hbox">
        <textarea
          ref={areaRef}
          className="jm-fv-h jm-fv-hedit"
          value={draft}
          rows={1}
          maxLength={120}
          aria-label={t("titolo della giornata")}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow(e.target);
          }}
          onBlur={conferma}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void conferma();
            } else if (e.key === "Escape") {
              e.preventDefault();
              annulla();
            }
          }}
        />
        <div className="jm-fv-hhint">{t("tocca fuori per salvare")}</div>
      </div>
    );
  }

  return (
    <div className="jm-fv-hbox">
      <h1
        className={`jm-fv-h jm-fv-htap${hasHeadline ? "" : " placeholder"}${saving ? " saving" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={t("modifica il titolo della giornata")}
        onClick={apri}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            apri();
          }
        }}
      >
        {hasHeadline
          ? testo
          : t("giornata raccontata, l'AI non ha ancora generato un titolo")}
        {locked ? (
          <span className="jm-fv-tuo">{t("tuo")}</span>
        ) : (
          <svg
            className="jm-fv-hpen"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        )}
      </h1>
    </div>
  );
}

/** Il campo cresce con il titolo invece di scorrere dentro una riga sola. */
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
