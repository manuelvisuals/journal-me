/**
 * L'interruttore del checkout finto (richiesta di Manuel del 21 agosto
 * 2026: "solo in fase di sviluppo, consenti di abbonarsi senza pagare").
 *
 * PERCHE C'E UN INTERRUTTORE. journal-me-weld.vercel.app E la produzione:
 * e li che si prova. Una pagina che regala il premium, lasciata accesa,
 * lo regala a chiunque la trovi. Quindi:
 *
 *  1. `NEXT_PUBLIC_JM_FAKE_CHECKOUT=1` accende pagina e rotta. Spenta, la
 *     pagina risponde 404 e la rotta pure — non un errore parlante, che
 *     direbbe a chi passa che qui c'e qualcosa da forzare.
 *  2. `JM_FAKE_CHECKOUT_EMAILS` (solo server, senza NEXT_PUBLIC_) elenca
 *     chi puo usarla. Doppia serratura: se un giorno l'interruttore resta
 *     acceso per sbaglio, il danno resta zero.
 *
 * La prima variabile e NEXT_PUBLIC_ perche il muro premium, nel browser,
 * deve sapere dove mandare l'utente. Non e un buco: dice solo "qui esiste
 * una pagina di prova", e chi la apre senza essere in elenco si sente dire
 * di no dal server, che e l'unico che scrive il piano.
 */

/** Acceso? Vale in entrambi i mondi: il browser legge la stessa costante. */
export function fakeCheckoutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_JM_FAKE_CHECKOUT === "1";
}

/**
 * Email autorizzate, minuscole e senza spazi. Solo server: in un bundle
 * del browser `process.env.JM_FAKE_CHECKOUT_EMAILS` non esiste e questa
 * funzione ritorna una lista vuota (quindi: nessuno autorizzato).
 */
export function fakeCheckoutEmails(): string[] {
  return (process.env.JM_FAKE_CHECKOUT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/** Vuoto = nessuno. Mai "vuoto = tutti": e cosi che si regalano le cose. */
export function fakeCheckoutAllows(email: string | null): boolean {
  if (!email) return false;
  return fakeCheckoutEmails().includes(email.trim().toLowerCase());
}

/** Da cosa si riconosce un premium finto in `profiles.plan_source`. */
export const FAKE_PLAN_SOURCE = "dev";
