/**
 * Dove sta il seme della cassaforte, su questo dispositivo (SPEC R8).
 *
 *  - nel guscio iOS: Keychain sincronizzato con iCloud, via il plugin nativo
 *    `Cassaforte` (ios/App/App/Cassaforte.swift). Arriva da solo sugli altri
 *    dispositivi Apple della stessa persona;
 *  - sul web: IndexedDB `journalme-chiave`, un database tutto suo, separato
 *    da `journalme` (che e lo scheletro dei dati) e da `journalme-foto`.
 *    Chi svuota i dati del sito perde il seme e lo rimette con le parole.
 *
 * Il seme e legato all'utente (`conto` = user id): due account sullo stesso
 * dispositivo non si pestano i piedi. Non si tiene mai in localStorage: e
 * leggibile da qualsiasi script della pagina e finisce nei backup in chiaro
 * di Safari.
 */
import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";
import { base64DaByte, byteDaBase64 } from "./serratura";

type PluginCassaforte = {
  leggi(o: { conto: string }): Promise<{ seme: string | null }>;
  scrivi(o: { conto: string; seme: string }): Promise<void>;
  cancella(o: { conto: string }): Promise<void>;
};

let plugin: PluginCassaforte | null = null;
function nativo(): PluginCassaforte | null {
  if (!isNative()) return null;
  if (!plugin) plugin = registerPlugin<PluginCassaforte>("Cassaforte");
  return plugin;
}

const DB_NOME = "journalme-chiave";
const STORE = "semi";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbLeggi(conto: string): Promise<Uint8Array | null> {
  const db = await idb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(conto);
      req.onsuccess = () => resolve(req.result ? byteDaBase64(req.result as string) : null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbScrivi(conto: string, seme: Uint8Array | null): Promise<void> {
  const db = await idb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      if (seme) st.put(base64DaByte(seme), conto);
      else st.delete(conto);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Il seme salvato su questo dispositivo per questo utente, o null. */
export async function leggiSeme(conto: string): Promise<Uint8Array | null> {
  const p = nativo();
  if (p) {
    const { seme } = await p.leggi({ conto });
    return seme ? byteDaBase64(seme) : null;
  }
  return idbLeggi(conto);
}

export async function scriviSeme(conto: string, seme: Uint8Array): Promise<void> {
  const p = nativo();
  if (p) {
    await p.scrivi({ conto, seme: base64DaByte(seme) });
    return;
  }
  await idbScrivi(conto, seme);
}

export async function cancellaSeme(conto: string): Promise<void> {
  const p = nativo();
  if (p) {
    await p.cancella({ conto });
    return;
  }
  await idbScrivi(conto, null);
}

/** Dove vive la chiave su questo dispositivo, per dirlo in Impostazioni. */
export function sedeDellaChiave(): "portachiavi" | "browser" {
  return isNative() ? "portachiavi" : "browser";
}
