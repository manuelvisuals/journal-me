"use client";

/**
 * Le foto dal rullino di una giornata (mockup design/mockups/foto-rullino.html,
 * approvato il 1 settembre 2026).
 *
 * Il principio che governa tutto il file e la VELOCITA promessa dal mockup:
 * al momento della scelta si preparano DUE copie della foto — una miniatura
 * (~480px, qualche decina di KB) che e cio che la giornata mostra, e una
 * copia "da schermo" (~2048px) che viaggia solo quando la apri a schermo
 * pieno. L'originale del rullino non lascia mai il telefono.
 *
 * Due case, come per le giornate:
 *  - in modalita LOCALE le foto stanno in IndexedDB, in un database TUTTO
 *    LORO ("journalme-foto"), separato da "journalme": aggiungere un
 *    object store al database delle giornate vorrebbe dire alzargli la
 *    versione, e quel database e scheletro (src/lib/data/store/local.ts)
 *    — un modulo non lo tocca. Niente rete, come promesso.
 *  - in modalita CLOUD le foto stanno nel bucket privato `foto` di Supabase
 *    Storage (percorso <utente>/<giorno>/<id>.jpg) e la loro riga nella
 *    tabella `entry_photos` (migration 020). Il client Supabase si carica
 *    con un import DINAMICO, cosi un build solo-locale non lo costruisce
 *    mai — stessa regola di src/lib/data/store/index.ts.
 *
 * Le foto appartengono al GIORNO (data YYYY-MM-DD), non alla giornata
 * scritta: un giorno senza racconto puo avere le sue foto, e cancellare il
 * racconto non cancella i ricordi.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type ModoFoto = "local" | "cloud";

export type FotoGiornata = {
  id: string;
  day: string; // YYYY-MM-DD
  /** Quando la foto e stata scattata (dal file del rullino), per l'ordine. */
  takenAt: string;
  w: number;
  h: number;
};

/* ---------------------------------------------------------------------
   L'annuncio: chi aggiunge o toglie foto lo dice, chi le mostra ascolta.
   Un CustomEvent e non uno store condiviso perche i due punti (il foglio
   di AddToDay e la striscia in FilledView) vivono in alberi diversi.
   --------------------------------------------------------------------- */

export const EVENTO_FOTO = "jm:foto-cambiate";

export function annunciaFoto(day: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_FOTO, { detail: { day } }));
}

/* ------------------------- misure delle copie ------------------------- */

const LATO_MINIATURA = 480; // 80pt a schermo, x3 retina, con margine
const LATO_INTERA = 2048; // basta e avanza per uno schermo, non e il rullino
const QUALITA_MINIATURA = 0.75;
const QUALITA_INTERA = 0.82;

/* ----------------------------- IndexedDB ------------------------------ */

type RigaFoto = FotoGiornata & { thumb: Blob; full: Blob };

interface FotoDB extends DBSchema {
  foto: {
    key: string;
    value: RigaFoto;
    indexes: { day: string };
  };
}

let dbPromise: Promise<IDBPDatabase<FotoDB>> | null = null;

function db(): Promise<IDBPDatabase<FotoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FotoDB>("journalme-foto", 1, {
      upgrade(d) {
        const store = d.createObjectStore("foto", { keyPath: "id" });
        store.createIndex("day", "day");
      },
    });
  }
  return dbPromise;
}

/* ------------------------------- cloud -------------------------------- */

async function supabaseCloud() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

/**
 * L'id dell'utente senza giri di rete: prima la sessione in memoria, poi
 * getUser come seconda strada (stessa dottrina di CloudStore.userId — chi
 * puo scrivere davvero lo decidono le regole RLS, riga per riga).
 */
async function userIdCloud(
  supabase: Awaited<ReturnType<typeof supabaseCloud>>,
): Promise<string> {
  const { data: sessione } = await supabase.auth.getSession();
  const fromSession = sessione.session?.user?.id;
  if (fromSession) return fromSession;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

const BUCKET = "foto";

function percorso(uid: string, foto: Pick<FotoGiornata, "id" | "day">): {
  intera: string;
  miniatura: string;
} {
  const base = `${uid}/${foto.day}/${foto.id}`;
  return { intera: `${base}.jpg`, miniatura: `${base}.min.jpg` };
}

/* ------------------------------ elenco -------------------------------- */

/**
 * QUANTE FOTO AVEVA IL GIORNO L'ULTIMA VOLTA (2 settembre 2026, richiesta
 * di Manuel: "significativo layout shift nella zona delle foto").
 *
 * L'elenco delle foto arriva dalla rete (o da IndexedDB) DOPO che la
 * giornata e gia disegnata: la striscia compariva di colpo e spingeva
 * tutto in basso — aree, persone, luoghi — mentre l'occhio stava gia
 * leggendo. Il rimedio e riservare lo spazio prima di sapere: ma per
 * riservarlo bisogna sapere ALMENO se quel giorno ha foto e quante.
 *
 * Questa memoria e la risposta: a ogni elenco letto si annota per giorno
 * il numero di foto, in localStorage, su questo dispositivo. Al prossimo
 * passaggio la striscia si disegna subito con le caselle vuote
 * (scintillanti, .jm-skel) e le foto vere prendono il loro posto senza
 * spostare niente. E una PROMESSA, non una verita: se nel frattempo le
 * foto sono state tolte da un altro dispositivo, lo spazio si richiude
 * appena arriva l'elenco — un rientro, che e molto meno brutto di
 * un'irruzione. La prima visita in assoluto a un giorno con foto resta
 * senza avviso: nessuno puo sapere prima cio che non ha mai letto.
 */
const KEY_CONTEGGI = "jm.foto.conteggi";

function leggiConteggi(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_CONTEGGI);
    const val = raw ? (JSON.parse(raw) as unknown) : null;
    return val && typeof val === "object" ? (val as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Quante foto aveva il giorno l'ultima volta che le abbiamo lette (0 = mai viste). */
export function fotoAttese(day: string): number {
  const n = leggiConteggi()[day];
  return typeof n === "number" && n > 0 ? Math.floor(n) : 0;
}

function annotaConteggio(day: string, n: number): void {
  if (typeof window === "undefined") return;
  try {
    const tutti = leggiConteggi();
    if (n > 0) tutti[day] = n;
    else delete tutti[day];
    window.localStorage.setItem(KEY_CONTEGGI, JSON.stringify(tutti));
  } catch {
    // Storage negato: si perde solo la promessa, non le foto.
  }
}

export async function elencoFoto(
  modo: ModoFoto,
  day: string,
): Promise<FotoGiornata[]> {
  const lista = await elencoFotoGrezzo(modo, day);
  annotaConteggio(day, lista.length);
  return lista;
}

async function elencoFotoGrezzo(
  modo: ModoFoto,
  day: string,
): Promise<FotoGiornata[]> {
  if (modo === "local") {
    const righe = await (await db()).getAllFromIndex("foto", "day", day);
    return righe
      .map(({ id, day: d, takenAt, w, h }) => ({ id, day: d, takenAt, w, h }))
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  }
  const supabase = await supabaseCloud();
  const { data, error } = await supabase
    .from("entry_photos")
    .select("id, day, taken_at, w, h")
    .eq("day", day)
    .order("taken_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    day: String(r.day),
    takenAt: String(r.taken_at),
    w: (r.w as number) ?? 0,
    h: (r.h as number) ?? 0,
  }));
}

/* ----------------------------- aggiunta -------------------------------- */

export async function aggiungiFoto(
  modo: ModoFoto,
  day: string,
  files: ArrayLike<File>,
): Promise<number> {
  const lista = Array.from(files).filter((f) => f.type.startsWith("image/"));
  let fatte = 0;
  for (const file of lista) {
    const sorgente = await decodifica(file);
    try {
      const intera = await ridotta(sorgente, LATO_INTERA, QUALITA_INTERA);
      const miniatura = await ridotta(sorgente, LATO_MINIATURA, QUALITA_MINIATURA);
      const foto: FotoGiornata = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        day,
        // Il rullino non espone la data di scatto al web: lastModified e
        // cio che le si avvicina di piu (per una foto di camera E la data
        // di scatto). Meglio di "adesso", che ordinerebbe per selezione.
        takenAt: new Date(file.lastModified || Date.now()).toISOString(),
        w: intera.w,
        h: intera.h,
      };
      if (modo === "local") {
        await (await db()).put("foto", {
          ...foto,
          thumb: miniatura.blob,
          full: intera.blob,
        });
      } else {
        const supabase = await supabaseCloud();
        const uid = await userIdCloud(supabase);
        const p = percorso(uid, foto);
        const su1 = await supabase.storage
          .from(BUCKET)
          .upload(p.miniatura, miniatura.blob, { contentType: "image/jpeg" });
        if (su1.error) throw new Error(su1.error.message);
        const su2 = await supabase.storage
          .from(BUCKET)
          .upload(p.intera, intera.blob, { contentType: "image/jpeg" });
        if (su2.error) throw new Error(su2.error.message);
        const { error } = await supabase.from("entry_photos").insert({
          id: foto.id,
          user_id: uid,
          day,
          taken_at: foto.takenAt,
          w: foto.w,
          h: foto.h,
          bytes: intera.blob.size + miniatura.blob.size,
        });
        if (error) throw new Error(error.message);
      }
      fatte += 1;
    } finally {
      chiudi(sorgente);
    }
  }
  return fatte;
}

/* --------------------------- eliminazione ------------------------------ */

export async function eliminaFoto(
  modo: ModoFoto,
  foto: FotoGiornata,
): Promise<void> {
  if (modo === "local") {
    await (await db()).delete("foto", foto.id);
  } else {
    const supabase = await supabaseCloud();
    const uid = await userIdCloud(supabase);
    const p = percorso(uid, foto);
    // Prima i file, poi la riga: una riga senza file e una miniatura rotta
    // a schermo, un file senza riga e solo spazio da ripulire.
    const rm = await supabase.storage
      .from(BUCKET)
      .remove([p.miniatura, p.intera]);
    if (rm.error) throw new Error(rm.error.message);
    const { error } = await supabase
      .from("entry_photos")
      .delete()
      .eq("id", foto.id);
    if (error) throw new Error(error.message);
  }
  scordaUrl(foto.id);
}

/* ------------------------------- URL ----------------------------------- */

/**
 * Gli object URL gia creati, per non riscaricare (cloud) o rileggere
 * (IndexedDB) la stessa immagine a ogni render. Vivono quanto la pagina:
 * revocarli a ogni smontaggio vorrebbe dire ricaricare le miniature a ogni
 * cambio di tab, che e l'opposto della promessa.
 */
const cacheUrl = new Map<string, string>();

function scordaUrl(id: string): void {
  for (const suffisso of ["min", "full"]) {
    const chiave = `${id}.${suffisso}`;
    const url = cacheUrl.get(chiave);
    if (url) {
      URL.revokeObjectURL(url);
      cacheUrl.delete(chiave);
    }
  }
}

export async function urlMiniatura(
  modo: ModoFoto,
  foto: FotoGiornata,
): Promise<string | null> {
  return urlDi(modo, foto, "min");
}

export async function urlIntera(
  modo: ModoFoto,
  foto: FotoGiornata,
): Promise<string | null> {
  return urlDi(modo, foto, "full");
}

async function urlDi(
  modo: ModoFoto,
  foto: FotoGiornata,
  quale: "min" | "full",
): Promise<string | null> {
  const chiave = `${foto.id}.${quale}`;
  const nota = cacheUrl.get(chiave);
  if (nota) return nota;
  let blob: Blob | null = null;
  if (modo === "local") {
    const riga = await (await db()).get("foto", foto.id);
    blob = riga ? (quale === "min" ? riga.thumb : riga.full) : null;
  } else {
    const supabase = await supabaseCloud();
    const uid = await userIdCloud(supabase);
    const p = percorso(uid, foto);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(quale === "min" ? p.miniatura : p.intera);
    if (error) return null;
    blob = data;
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  cacheUrl.set(chiave, url);
  return url;
}

/* ------------------------ ridimensionamento ---------------------------- */

type Sorgente =
  | { kind: "bitmap"; bmp: ImageBitmap }
  | { kind: "img"; el: HTMLImageElement; url: string };

/**
 * Decodifica il file scelto. Prima strada createImageBitmap (decodifica
 * fuori dal main thread, orientamento EXIF applicato dal browser); se il
 * browser non ce l'ha o inciampa (capita coi formati strani), un <img>
 * classico fa da seconda strada.
 */
async function decodifica(file: File): Promise<Sorgente> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { kind: "bitmap", bmp };
    } catch {
      // si passa alla seconda strada
    }
  }
  const url = URL.createObjectURL(file);
  const el = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("immagine illeggibile"));
    im.src = url;
  });
  return { kind: "img", el, url };
}

function chiudi(s: Sorgente): void {
  if (s.kind === "bitmap") s.bmp.close();
  else URL.revokeObjectURL(s.url);
}

function misure(s: Sorgente): { w: number; h: number } {
  return s.kind === "bitmap"
    ? { w: s.bmp.width, h: s.bmp.height }
    : { w: s.el.naturalWidth, h: s.el.naturalHeight };
}

async function ridotta(
  s: Sorgente,
  latoMax: number,
  qualita: number,
): Promise<{ blob: Blob; w: number; h: number }> {
  const { w, h } = misure(s);
  const scala = Math.min(1, latoMax / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scala));
  const nh = Math.max(1, Math.round(h * scala));
  const tela = document.createElement("canvas");
  tela.width = nw;
  tela.height = nh;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("canvas non disponibile");
  ctx.drawImage(s.kind === "bitmap" ? s.bmp : s.el, 0, 0, nw, nh);
  const blob = await new Promise<Blob>((res, rej) => {
    tela.toBlob(
      (b) => (b ? res(b) : rej(new Error("conversione fallita"))),
      "image/jpeg",
      qualita,
    );
  });
  return { blob, w: nw, h: nh };
}
