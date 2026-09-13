/**
 * L'indirizzo dell'assistenza, e basta: nessun React, nessun import, niente
 * che non sia una stringa. Sta separato dai hook (assistenza.ts) perche
 * cosi il banco lo puo importare da solo
 * (node --experimental-strip-types scripts/verify-linguetta-assistenza.mjs)
 * senza montare mezza app per provare una concatenazione.
 *
 * Il perche di ogni pezzo e in testa a assistenza.ts.
 */

/** Il sito, per intero. Serve solo dentro il guscio iOS: vedi sopra. */
export const SITO = "https://www.dayalogue.com";

export function indirizzoAssistenza(o: {
  /** Dentro il guscio iOS. */
  nativo: boolean;
  lingua: "it" | "en";
  email?: string | null;
  versione?: string | null;
  schermata?: string | null;
}): string {
  const percorso = o.lingua === "en" ? "/en/support" : "/support";
  const q = new URLSearchParams({ da: "app" });
  if (o.email) q.set("email", o.email);
  if (o.versione) q.set("v", o.versione);
  if (o.schermata) q.set("s", o.schermata);
  return `${o.nativo ? SITO : ""}${percorso}?${q.toString()}`;
}

/**
 * GLI INDIRIZZI CHE SONO "CASA NOSTRA". Il campo del pannello nasce gia
 * pieno: il messaggio di benvenuto di fabbrica (lib/benvenuto.ts, seed
 * della migration 018) dice "/support". Quindi la linguetta un indirizzo ce
 * l'aveva — quello nudo, senza niente dietro, e dentro il guscio iOS
 * addirittura rotto, perche li /support non esiste nel pacchetto.
 *
 * Per questo non basta "se il pannello e vuoto": si riconoscono anche le
 * nostre pagine, e in quel caso l'indirizzo si RIFA (lingua giusta, sito
 * intero se siamo nel guscio, e cio che sappiamo di chi scrive). Un
 * indirizzo diverso — il giorno che Manuel ne scrive uno suo — si rispetta
 * e non si tocca.
 */
const CASA_NOSTRA = ["/support", "/support/", "/en/support", "/en/support/"];

export function destinazioneLinguetta(
  dalPannello: string,
  o: Parameters<typeof indirizzoAssistenza>[0],
): string {
  const scritto = dalPannello.trim();
  const nostra = scritto === "" || CASA_NOSTRA.includes(scritto.split("?")[0]);
  return nostra ? indirizzoAssistenza(o) : scritto;
}

