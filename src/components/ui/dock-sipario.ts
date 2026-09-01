"use client";

/**
 * IL SIPARIO DEL DOCK (1 settembre 2026, screenshot di Manuel).
 *
 * Quando una superficie a schermo pieno e aperta — i chiarimenti, il
 * messaggio di benvenuto, la registrazione, un foglio dal basso — il dock
 * non va "coperto": NON DEVE ESISTERE. Il motivo e fisico, non estetico:
 * dentro il guscio iOS la pillola e una lastra di vetro NATIVA appoggiata
 * SOPRA la WebView (DockVetro.swift), quindi nessuno z-index del web puo
 * metterle qualcosa davanti. Il rilevamento "il dock e coperto?" via
 * elementFromPoint (dock-vetro.ts) resta come rete, ma sul telefono si e
 * dimostrato non affidabile: i tasti dei chiarimenti finivano DIETRO la
 * lastra e non si toccavano. Percio la via maestra e il sipario: la
 * superficie dichiara "sono a schermo pieno" e il dock si smonta — e lo
 * smontaggio spegne la lastra nativa per la via gia collaudata del cambio
 * pagina (la cleanup di useVetroNativo chiama nascondi), senza nessuna
 * misura di mezzo. Chiusa la superficie, il dock rimonta e il vetro torna.
 *
 * E anche la risposta di design (la domanda di Manuel "chiedi a Ive"):
 * una schermata che ti fa UNA domanda e un compito a fuoco pieno — la
 * navigazione non c'entra, e toglierla e cio che rende i tasti in fondo
 * sempre tuoi. Le opzioni scorrono, i tasti stanno fermi, il dock non c'e.
 *
 * Contratto: una superficie monta `useRitiraDock()` e finche vive il dock
 * non esiste; il conteggio regge superfici annidate (un foglio sopra un
 * overlay). La tab bar legge `useDockRitirato()` e si smonta.
 */

import { useEffect, useSyncExternalStore } from "react";

let conto = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Per la tab bar: true se almeno una superficie a schermo pieno e viva. */
export function useDockRitirato(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => conto > 0,
    () => false,
  );
}

/**
 * Per le superfici a schermo pieno: finche il componente che la chiama e
 * montato (e `attivo` e vero), il dock non esiste.
 */
export function useRitiraDock(attivo: boolean = true): void {
  useEffect(() => {
    if (!attivo) return;
    conto += 1;
    emit();
    return () => {
      conto -= 1;
      emit();
    };
  }, [attivo]);
}
