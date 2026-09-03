// La promessa nuova sulla rete (SPEC-ospite-e-cassaforte, par. 5), in un
// posto solo, cosi ogni banco che la difende la misura allo stesso modo.
//
// La promessa vecchia era "in modalita locale nemmeno una richiesta di
// rete". L'ospite la rompe per forza: tiene le giornate sul dispositivo e
// chiama l'AI. Quella nuova, che sostituisce la vecchia:
//
//   Delle giornate dell'ospite, sul server non resta niente. Il testo esce
//   dal dispositivo solo nel momento in cui l'ospite chiede all'AI di
//   lavorarci, e solo per quello: non viene scritto ne conservato da
//   nessuna parte.
//
// Misurata cosi, richiesta per richiesta:
//   1. nessuna richiesta verso un'origine esterna (Supabase compreso: dal
//      browser di un ospite non parte niente verso il database, e nessun
//      terzo riceve niente);
//   2. le sole richieste verso il proprio server sono le route AI
//      dell'ELENCO CHIUSO qui sotto (piu /api/ospite/stato, che non porta
//      testo), e ognuna porta il braccialetto (x-jm-braccialetto): una
//      chiamata AI senza braccialetto e una chiamata che nessuno ha chiesto;
//   3. nessuna scrittura verso le tabelle delle giornate (entries,
//      cassettine, facts, remembers, recaps...): cioe nessun URL /rest/v1/
//      di quelle tabelle, da nessuna parte.
//
// In modalita locale SENZA ospite (interruttore spento) la promessa
// collassa in quella vecchia: nessuna chiamata e ammessa, perche non c'e
// un braccialetto che la firmi.

/** Le route AI che un ospite puo chiamare. Toccare questa lista e una decisione, non un dettaglio. */
export const ROUTE_AI_OSPITE = [
  "/api/transcribe-fallback",
  "/api/process-entry",
  "/api/split-by-date",
  "/api/extract-facts",
  "/api/chiarimenti",
  "/api/remember/classify",
];
export const ROUTE_AMMESSE_OSPITE = [...ROUTE_AI_OSPITE, "/api/ospite/stato"];

const TABELLE_DELLE_GIORNATE = /\/rest\/v1\/(entries|cassettine|facts|remembers|recaps|open_questions|fact_aliases|day_exclusions|foto)\b/;

/**
 * Registra ogni richiesta della pagina. `base` e l'origine del dev server.
 * Ritorna il registro, da passare a verificaPromessa().
 */
export function osservaPromessa(page, base) {
  const reg = { esterne: [], api: [], tabelle: [] };
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("data:") || u.startsWith("blob:")) return;
    if (TABELLE_DELLE_GIORNATE.test(u)) reg.tabelle.push(`${r.method()} ${u}`);
    if (u.startsWith(base)) {
      const p = new URL(u).pathname;
      if (p.startsWith("/api/")) {
        reg.api.push({ metodo: r.method(), path: p, braccialetto: r.headers()["x-jm-braccialetto"] ?? null });
      }
      return;
    }
    reg.esterne.push(u);
  });
  return reg;
}

/**
 * Le tre regole, in un verdetto solo. `dettagli` dice cosa e andato storto
 * (le prime tre voci), per incollarlo a Claude.
 */
export function verificaPromessa(reg) {
  const problemi = [];
  for (const u of reg.esterne) problemi.push(`richiesta esterna: ${u}`);
  for (const a of reg.api) {
    if (!ROUTE_AMMESSE_OSPITE.includes(a.path)) problemi.push(`route fuori dall'elenco chiuso: ${a.metodo} ${a.path}`);
    else if (!a.braccialetto) problemi.push(`chiamata senza braccialetto: ${a.metodo} ${a.path}`);
  }
  for (const t of reg.tabelle) problemi.push(`tabella delle giornate toccata: ${t}`);
  return { ok: problemi.length === 0, dettagli: problemi.slice(0, 3).join(" | ") };
}
