"use client";

/**
 * Bozze dell'editor (SPEC-v2 §6). La bozza e SEMPRE su IndexedDB, in
 * ENTRAMBE le modalita: anche per un utente cloud il testo a meta strada
 * non deve mai passare dalla rete. Per questo il modulo non usa
 * getStore() come interfaccia dati ma lo usa solo per riciclare la
 * connessione IDB quando la modalita e gia locale; in cloud apre lo
 * stesso database `journalme` con un'istanza dedicata.
 *
 * Contratto (spec §6):
 *  - salvataggio ogni 800ms di inattivita (il debounce sta nell'editor);
 *  - la bozza si cancella SOLO quando la giornata e stata salvata con
 *    successo (clearDraft chiamata dopo il save, mai prima);
 *  - l'indicatore non deve mai dire "salvato" se la scrittura e fallita:
 *    saveDraft ritorna false in quel caso e chi chiama non aggiorna l'ora.
 */

import { getStore } from "@/lib/data/store";
import { LocalStore, type DraftRecord } from "@/lib/data/store/local";

export type { DraftRecord };

let dedicated: LocalStore | null = null;

function draftsDb(): LocalStore {
  const store = getStore();
  if (store instanceof LocalStore) return store;
  if (!dedicated) dedicated = new LocalStore();
  return dedicated;
}

export async function loadDraft(entryDate: string): Promise<DraftRecord | null> {
  try {
    const d = await draftsDb().getDraft(entryDate);
    return d && d.text.trim().length > 0 ? d : null;
  } catch {
    return null;
  }
}

/** true se la bozza e davvero su disco, false se la scrittura e fallita. */
export async function saveDraft(entryDate: string, text: string): Promise<boolean> {
  try {
    await draftsDb().putDraft(entryDate, text);
    return true;
  } catch {
    return false;
  }
}

export async function clearDraft(entryDate: string): Promise<void> {
  try {
    await draftsDb().deleteDraft(entryDate);
  } catch {
    // gia assente o storage negato: niente da fare
  }
}
