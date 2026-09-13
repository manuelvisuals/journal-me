/**
 * QUANDO chiedere la recensione (13 settembre 2026; mockup
 * admin-iscritti.html, sezione 04). Il pezzo nativo e in
 * lib/native/recensione.ts; qui c'e la regola, che vive sul telefono:
 *
 *   1. l'interruttore sul server e acceso (letto una volta al giorno, e
 *      solo dove l'app fa gia rete: in cloud o da ospite; chi e in locale
 *      puro non fa richieste e non viene chiesto);
 *   2. su QUESTO telefono sono state salvate almeno N giornate (contatore
 *      locale, cresce a ogni giornata salvata);
 *   3. non e stato chiesto negli ultimi 120 giorni.
 *
 * Il momento lo sceglie chi chiama (`today-client`): la giornata appena
 * chiusa, a schermata tornata piena. Mai all'avvio.
 *
 * Si registra sul server ogni richiesta fatta (POST /api/recensione), senza
 * chi: e il contatore che si vede in /admin.
 */
import { apiUrl } from "@/lib/api";
import { chiediRecensioneNativa, recensionePossibile } from "@/lib/native/recensione";
import { ospiteAttivo } from "@/lib/ospite/flag";
import { RECENSIONE_DI_FABBRICA, RECENSIONE_OGNI_GIORNI, type Recensione } from "@/lib/recensione-contract";

const K_GIORNATE = "jm.recensione.giornate";
const K_ULTIMA = "jm.recensione.ultima";
const K_STATO = "jm.recensione.stato";
const GIORNO_MS = 86_400_000;

function leggi(chiave: string): string | null {
  try {
    return window.localStorage.getItem(chiave);
  } catch {
    return null;
  }
}
function scrivi(chiave: string, valore: string): void {
  try {
    window.localStorage.setItem(chiave, valore);
  } catch {
    // niente localStorage: niente contatore, niente richiesta
  }
}

/** Una giornata salvata su questo telefono: il contatore cresce. */
export function segnaGiornataSalvata(): number {
  const n = (Number(leggi(K_GIORNATE)) || 0) + 1;
  scrivi(K_GIORNATE, String(n));
  return n;
}

export function giornateSalvateQui(): number {
  return Number(leggi(K_GIORNATE)) || 0;
}

/** L'interruttore, dal server, tenuto un giorno. */
async function statoRecensione(): Promise<Recensione> {
  const grezzo = leggi(K_STATO);
  if (grezzo) {
    try {
      const s = JSON.parse(grezzo) as { letto: number; attiva: boolean; giornateMinime: number };
      if (Date.now() - s.letto < GIORNO_MS) return { attiva: s.attiva, giornateMinime: s.giornateMinime };
    } catch {
      // stato corrotto: si rilegge
    }
  }
  try {
    const resp = await fetch(apiUrl("/api/recensione"), { method: "GET", cache: "no-store" });
    if (!resp.ok) return RECENSIONE_DI_FABBRICA;
    const r = (await resp.json()) as Partial<Recensione>;
    const stato: Recensione = {
      attiva: r.attiva === true,
      giornateMinime: Number.isFinite(Number(r.giornateMinime)) ? Number(r.giornateMinime) : RECENSIONE_DI_FABBRICA.giornateMinime,
    };
    scrivi(K_STATO, JSON.stringify({ letto: Date.now(), ...stato }));
    return stato;
  } catch {
    return RECENSIONE_DI_FABBRICA;
  }
}

/**
 * Da chiamare a giornata chiusa e schermata tornata piena. `mode` e la
 * modalita di archiviazione: in "local" si va avanti solo se l'ospite e
 * acceso (cioe se l'app fa gia rete per l'AI in regalo).
 */
export async function forseChiediRecensione(mode: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!recensionePossibile()) return false;
  if (mode !== "cloud" && !ospiteAttivo()) return false;

  const ultima = Number(leggi(K_ULTIMA)) || 0;
  if (ultima && Date.now() - ultima < RECENSIONE_OGNI_GIORNI * GIORNO_MS) return false;

  const stato = await statoRecensione();
  if (!stato.attiva) return false;
  if (giornateSalvateQui() < stato.giornateMinime) return false;

  const chiesto = await chiediRecensioneNativa();
  if (!chiesto) return false;
  scrivi(K_ULTIMA, String(Date.now()));
  try {
    void fetch(apiUrl("/api/recensione"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ piattaforma: "ios" }) });
  } catch {
    // il contatore non conta abbastanza da fermare niente
  }
  return true;
}
