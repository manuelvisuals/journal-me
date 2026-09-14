/**
 * Cosa la linguetta Feedback dell'app puo mettere nell'indirizzo di
 * /support, e come si legge senza fidarsi.
 *
 * PERCHE DALL'INDIRIZZO E NON DALLA SESSIONE. Dal telefono la linguetta
 * apre il BROWSER, che e un programma diverso dall'app: li dentro la
 * sessione dell'app non esiste, e nessuna lettura locale potrebbe trovarla.
 * L'indirizzo e l'unico bagaglio che passa quel confine. Sul web e lo
 * stesso indirizzo, cosi il percorso e uno solo.
 *
 * QUELLO CHE ARRIVA DI QUI NON E UNA PROVA DI NIENTE: chiunque puo
 * scriversi un indirizzo a mano. L'email precompilata e una cortesia (un
 * campo in meno da riempire), non un'identita: resta modificabile, e il
 * server non ci fonda nessuna decisione. Per questo qui si taglia e basta,
 * senza controllare che l'indirizzo esista.
 */

import type { Precompilato } from "@/modules/sito/components/supporto";

/** La forma che Next da a searchParams di una pagina (Next 16: e una Promise). */
export type ParametriPagina = Promise<Record<string, string | string[] | undefined>>;

function uno(v: string | string[] | undefined, max: number): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const pulito = (s ?? "").trim().slice(0, max);
  return pulito === "" ? undefined : pulito;
}

export function precompilatoDaIndirizzo(
  p: Record<string, string | string[] | undefined>,
): Precompilato | undefined {
  const precompilato: Precompilato = {
    email: uno(p.email, 320),
    da: uno(p.da, 20),
    versione: uno(p.v, 40),
    schermata: uno(p.s, 80),
  };
  // Niente parametri, niente oggetto: chi arriva da Google non deve
  // trascinarsi dietro un oggetto vuoto fino al modulo.
  return Object.values(precompilato).some((x) => x !== undefined)
    ? precompilato
    : undefined;
}
