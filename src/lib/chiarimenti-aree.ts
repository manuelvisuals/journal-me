/**
 * Dove finisce una cosa quando rispondi a una domanda sull'area.
 *
 * Vive in un file suo, separato da src/lib/chiarimenti.ts, per un motivo
 * pratico: qui dentro non c'e nessuna importazione che non sia di tipi,
 * quindi si puo provare con `node --experimental-strip-types` senza browser,
 * senza rete e senza AI. E l'unico pezzo di questa funzione che ha una logica
 * abbastanza intricata da poter essere sbagliata in silenzio, ed e giusto che
 * sia anche l'unico che si puo provare cosi a fondo.
 */

import type { AreaSummary } from "@/lib/types";

/**
 * Sposta un soggetto fra le aree di UNA giornata. Funzione pura, cosi si
 * puo provare senza browser e senza AI (scripts/verify-chiarimenti.mjs).
 *
 * `scelte` vuoto significa "non saprei": il soggetto esce da tutte le aree
 * candidate e non entra da nessuna parte. E il comportamento voluto.
 *
 * Un'area che rimane senza testo sparisce: un'etichetta "Movimento" con
 * sotto il vuoto e peggio dell'assenza, perche sembra un errore.
 */
export function spostaFraAree(
  aree: AreaSummary[],
  soggetto: string,
  scelte: string[],
  candidate: string[],
): AreaSummary[] {
  const sog = soggetto.trim();
  if (!sog) return aree;

  const scelteSet = new Set(scelte.map((s) => s.trim()).filter(Boolean));
  // Le aree da cui il soggetto va tolto: quelle che erano fra le opzioni ma
  // non sono state scelte. Le altre aree non si toccano mai — la risposta
  // riguardava una cosa sola, non tutta la giornata.
  const daRipulire = new Set(
    candidate.map((c) => c.trim()).filter((c) => c && !scelteSet.has(c)),
  );

  const fuori: AreaSummary[] = [];
  for (const a of aree) {
    if (!daRipulire.has(a.label)) {
      fuori.push(a);
      continue;
    }
    const ripulito = togliFrasiCon(a.text, sog);
    if (ripulito.trim().length > 0) fuori.push({ ...a, text: ripulito });
  }

  for (const scelta of scelteSet) {
    const esistente = fuori.find((a) => a.label === scelta);
    if (esistente) {
      if (!menziona(esistente.text, sog)) {
        esistente.text = `${esistente.text.trim()} ${frase(sog)}`.trim();
      }
    } else {
      fuori.push({ label: scelta, text: frase(sog) });
    }
  }

  return fuori;
}

function frase(soggetto: string): string {
  const s = soggetto.trim();
  const capo = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?]$/.test(capo) ? capo : `${capo}.`;
}

function menziona(testo: string, soggetto: string): boolean {
  return testo.toLowerCase().includes(soggetto.trim().toLowerCase());
}

/** Toglie le frasi che parlano del soggetto, lasciando le altre intatte. */
function togliFrasiCon(testo: string, soggetto: string): string {
  const s = soggetto.trim().toLowerCase();
  if (!s) return testo;
  return testo
    .split(/(?<=[.!?])\s+/)
    .filter((f) => !f.toLowerCase().includes(s))
    .join(" ")
    .trim();
}
