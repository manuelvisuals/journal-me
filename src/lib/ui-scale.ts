"use client";

/**
 * Il lato React della dimensione dell'interfaccia. I valori, le etichette e
 * l'applicazione a <html> stanno in `ui-scale-contract.ts`, che non importa
 * React perche lo usa anche lo script di boot (server).
 */

import { useSyncExternalStore } from "react";
import {
  applyUiScale,
  DEFAULT_UI_SCALE,
  isUiScale,
  UI_SCALE_STORAGE_KEY,
  type UiScale,
} from "@/lib/ui-scale-contract";

export {
  applyUiScale,
  DEFAULT_UI_SCALE,
  isUiScale,
  UI_SCALES,
  UI_SCALE_LABELS,
  UI_SCALE_STORAGE_KEY,
  type UiScale,
} from "@/lib/ui-scale-contract";

let scale: UiScale | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function read(): UiScale {
  if (scale != null) return scale;
  if (typeof window === "undefined") return DEFAULT_UI_SCALE;
  try {
    const n = Number(window.localStorage.getItem(UI_SCALE_STORAGE_KEY));
    scale = isUiScale(n) ? n : DEFAULT_UI_SCALE;
  } catch {
    scale = DEFAULT_UI_SCALE;
  }
  return scale;
}

export function getUiScale(): UiScale {
  return read();
}

export function setUiScale(next: UiScale): void {
  scale = next;
  try {
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(next));
  } catch {
    // Storage negato: vale per questa sessione e basta.
  }
  applyUiScale(next);
  emit();
}

/**
 * La chiama LangWatcher dopo il montaggio. Stessa ragione del bilingue: il
 * server non sa che scala ha scelto l'utente e renderizza a 1, quindi il
 * primo render del client deve dire 1 anche lui o React protesta. Lo
 * schermo pero e gia zoomato dallo script di boot: qui si allinea solo cio
 * che React sa.
 */
export function markUiScaleHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  emit();
}

function snapshot(): UiScale {
  return hydrated ? read() : DEFAULT_UI_SCALE;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useUiScale(): UiScale {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_UI_SCALE);
}
