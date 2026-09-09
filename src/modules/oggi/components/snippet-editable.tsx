"use client";

/**
 * La sintesi della giornata: scritta dall'AI, riconoscibile come tale, e
 * riscrivibile a mano come il titolo.
 *
 * Richiesta di Manuel dal telefono, 9 settembre 2026: "aggiungi il
 * simbolino delle stelline e fallo in corsivo, cosi si capisce che e fatto
 * dall'AI; alla fine il tasto della penna per modificarlo, come per il
 * titolo". Le stelline sono un SVG e non un'emoji: prendono il colore del
 * tema, come tutte le icone dell'app.
 *
 * Stessa regola del titolo (headline-editable.tsx): appena la riscrivi, la
 * sintesi e TUA e l'AI non la tocca piu, nemmeno quando la giornata viene
 * rianalizzata. Il blocco vive nel dato (snippetLocked), non qui.
 */

import { useEffect, useRef, useState } from "react";
import { saveSnippet } from "@/lib/data/entries";
import type { DataMode } from "@/lib/data/entries";
import { useT } from "@/lib/i18n";
import type { Entry } from "@/lib/types";

type Props = {
  snippet?: string | null;
  /** Gia riscritta a mano: la targhetta al posto della matita. */
  locked?: boolean;
  dateISO: string;
  mode: DataMode;
  onSaved: (entry: Entry) => void;
  onError?: (message: string) => void;
};

export function SnippetEditable({
  snippet,
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
  const doneRef = useRef(false);

  const testo = (snippet ?? "").trim();

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
    const nuovo = draft.trim().replace(/[ \t]+/g, " ");
    if (nuovo.length === 0 || nuovo === testo) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setEditing(false);
    try {
      const entry = await saveSnippet(mode, dateISO, nuovo);
      onSaved(entry);
    } catch (e) {
      onError?.(
        e instanceof Error ? e.message : t("non sono riuscito a salvare la sintesi"),
      );
    } finally {
      setSaving(false);
    }
  }

  function annulla() {
    doneRef.current = true;
    setEditing(false);
  }

  // Senza sintesi non c'e niente da mostrare ne da riscrivere: la sintesi
  // nasce dall'AI, a mano si corregge, non si inventa.
  if (testo.length === 0 && !editing) return null;

  if (editing) {
    return (
      <div className="jm-fv-snbox">
        <textarea
          ref={areaRef}
          className="jm-fv-sn jm-fv-snedit"
          value={draft}
          rows={3}
          maxLength={1200}
          aria-label={t("sintesi della giornata")}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow(e.target);
          }}
          onBlur={conferma}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
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
    <div className="jm-fv-snbox">
      <p
        className={`jm-fv-sn jm-fv-sntap${saving ? " saving" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={t("modifica la sintesi della giornata")}
        onClick={apri}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            apri();
          }
        }}
      >
        {/* Le stelline: "questo l'ha scritto l'AI". Quando la sintesi e tua
            restano lo stesso (il corsivo e la voce della sintesi, non
            dell'autore) ma al posto della matita c'e la targhetta. */}
        <svg className="jm-fv-ai" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
          <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
          <path d="M5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z" />
        </svg>
        {testo}
        {locked ? (
          <span className="jm-fv-tuo">{t("tuo")}</span>
        ) : (
          <svg className="jm-fv-hpen" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        )}
      </p>
    </div>
  );
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
