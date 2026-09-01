"use client";

/**
 * La scelta su Face ID (1 settembre 2026, richiesta di Manuel).
 *
 * Prima il lucchetto biometrico si accendeva DA SOLO al primo avvio: iOS
 * mostrava la richiesta di permesso a un utente che non aveva ancora nemmeno
 * fatto il login — una porta blindata montata prima della casa. Adesso Face
 * ID e una scelta, e la scelta si fa nel posto giusto: subito DOPO il codice
 * a sei cifre, quando l'app sa chi sei.
 *
 * Le regole, come le ha dette lui:
 *  - la proposta compare solo dopo un codice giusto, mai prima;
 *  - un si vale per sempre: non si richiede piu;
 *  - un no fa ricomparire la proposta al prossimo codice, per TRE volte;
 *    al terzo no un messaggio dice che non lo chiederemo piu e indica le
 *    Impostazioni, dove vive l'interruttore per cambiare idea;
 *  - dalle Impostazioni si attiva e si disattiva quando si vuole.
 *
 * La memoria sta in localStorage e non nel cloud, di proposito: Face ID e
 * una proprieta DI QUESTO telefono (un iPad senza Face ID non deve ereditare
 * la scelta fatta sull'iPhone), esattamente come il tema di boot.
 */

import { useSyncExternalStore } from "react";
import { isNative } from "@/lib/native/platform";

/** "on" | "off"; assente = nessuna decisione presa. */
const KEY_STATO = "jm.faceid";
/** Quante volte ha detto no alla proposta dopo il login. */
const KEY_RIFIUTI = "jm.faceid.rifiuti";

/** Al terzo no la proposta si spegne per sempre (resta l'interruttore). */
export const MAX_PROPOSTE_FACE_ID = 3;

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

function leggi(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function scrivi(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage negato: la scelta vale per la sessione e basta.
  }
}

export function faceIdAttivo(): boolean {
  return leggi(KEY_STATO) === "on";
}

export function attivaFaceId(): void {
  scrivi(KEY_STATO, "on");
  emit();
}

export function disattivaFaceId(): void {
  scrivi(KEY_STATO, "off");
  emit();
}

function rifiuti(): number {
  const n = Number(leggi(KEY_RIFIUTI));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Registra un no alla proposta e torna il conteggio aggiornato. */
export function registraRifiutoFaceId(): number {
  const n = rifiuti() + 1;
  scrivi(KEY_RIFIUTI, String(n));
  return n;
}

/**
 * La biometria di questo dispositivo esiste? Chiede al plugin, senza aprire
 * nessuna schermata di sistema: `checkBiometry` non mostra niente.
 */
export async function biometriaDisponibile(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { BiometricAuth } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable === true;
  } catch {
    return false;
  }
}

/**
 * Va mostrata la proposta dopo QUESTO login?
 * Solo nel guscio, solo se non c'e gia una decisione (un si o un off
 * dalle Impostazioni sono decisioni), solo entro i tre no, e solo se il
 * telefono ha davvero la biometria.
 */
export async function deveProporreFaceId(): Promise<boolean> {
  if (!isNative()) return false;
  if (leggi(KEY_STATO) !== null) return false;
  if (rifiuti() >= MAX_PROPOSTE_FACE_ID) return false;
  return biometriaDisponibile();
}

/**
 * Prova il Face ID adesso (permesso di sistema compreso, la prima volta) e
 * accende l'interruttore SOLO se la prova riesce: un "attivo" che poi non
 * sblocca sarebbe una porta senza chiave, al contrario.
 */
export async function provaEAttivaFaceId(reason: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { BiometricAuth } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    await BiometricAuth.authenticate({
      reason,
      allowDeviceCredential: true,
    });
    attivaFaceId();
    return true;
  } catch {
    return false;
  }
}

/** Lo stato per React (interruttore delle Impostazioni). */
export function useFaceIdAttivo(): boolean {
  return useSyncExternalStore(subscribe, faceIdAttivo, () => false);
}
