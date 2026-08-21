"use client";

/**
 * L'avviso di caricamento, UNO per tutta l'app.
 *
 * Perche esiste (richiesta di Manuel del 21 agosto 2026): premevi
 * "Continua" per aggiungere testo a una giornata e non succedeva niente per
 * qualche secondo — nessuna rotella, nessuna scritta. In quel silenzio
 * l'unica conclusione ragionevole e "non ha funzionato", e infatti e cio
 * che ha pensato. Il salvataggio invece partiva: passa da due chiamate AI
 * prima di scrivere sul database, e due o tre secondi sono un'eternita
 * davanti a uno schermo fermo.
 *
 * UNO SOLO, RIUSATO. Lo store vive nel modulo (stesso schema di
 * premium-wall e della palette comandi): chiunque puo chiamare
 * `toast.loading(...)` senza passare prop, e il componente e montato una
 * volta sola nel layout. Niente copie per schermata, niente spinner
 * disegnati a mano dentro i singoli bottoni.
 *
 * TRE STATI E BASTA:
 *  - `loading` resta finche non lo sostituisci: e una promessa che qualcosa
 *    sta succedendo, e va mantenuta finche succede;
 *  - `ok` sparisce da solo dopo 2,5 secondi;
 *  - `error` dopo 6, perche un errore va letto.
 *
 * Il messaggio di errore NON viene inghiottito: se un salvataggio fallisce
 * lo si vede scritto, invece di lasciare la schermata identica a prima.
 */

import { useEffect, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";

export type ToastKind = "loading" | "ok" | "error";

type Toast = { id: number; kind: ToastKind; text: string };

let current: Toast | null = null;
let seq = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function clearTimer(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

const AUTO_MS: Record<ToastKind, number | null> = {
  loading: null, // dura finche non lo sostituisci
  ok: 2500,
  error: 6000,
};

function show(kind: ToastKind, text: string): number {
  seq += 1;
  current = { id: seq, kind, text };
  clearTimer();
  const ms = AUTO_MS[kind];
  if (ms !== null && typeof window !== "undefined") {
    const mine = seq;
    timer = window.setTimeout(() => {
      // Solo se nel frattempo non e arrivato un altro avviso.
      if (current?.id === mine) {
        current = null;
        emit();
      }
    }, ms);
  }
  emit();
  return seq;
}

function hide(id?: number): void {
  if (id !== undefined && current?.id !== id) return;
  clearTimer();
  current = null;
  emit();
}

export const toast = {
  /** Parte un'attesa. Resta finche non arriva ok() o error(). */
  loading: (text: string) => show("loading", text),
  ok: (text: string) => show("ok", text),
  error: (text: string) => show("error", text),
  hide,
};

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function snapshot(): Toast | null {
  return current;
}

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/**
 * Montato UNA volta nel layout. Non ha prop e non sa chi lo ha chiamato:
 * e esattamente il punto: chiunque, da qualunque schermata.
 */
export function Toaster() {
  // `toastNow` e non `t`: `t` e la funzione di traduzione.
  const toastNow = useToast();

  // Un avviso di attesa che resta appeso per sempre e peggio di nessun
  // avviso: se dopo mezzo minuto nessuno lo ha sostituito, qualcosa e
  // andato storto in un modo che il codice non ha previsto, e lo si dice.
  useEffect(() => {
    if (!toastNow || toastNow.kind !== "loading") return;
    const id = window.setTimeout(() => {
      if (current?.id === toastNow.id)
        show("error", t("Ci sta mettendo troppo. Riprova."));
    }, 30_000);
    return () => window.clearTimeout(id);
  }, [toastNow]);

  if (!toastNow) return null;

  return (
    <div className="jm-toast-wrap" role="status" aria-live="polite">
      <div className={`jm-toast ${toastNow.kind}`}>
        {toastNow.kind === "loading" && (
          <span className="jm-toast-spin" aria-hidden="true" />
        )}
        {toastNow.kind === "ok" && (
          <svg className="jm-toast-ic" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {toastNow.kind === "error" && (
          <svg className="jm-toast-ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8v5M12 17h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
        <span className="jm-toast-t">{toastNow.text}</span>
      </div>
    </div>
  );
}
