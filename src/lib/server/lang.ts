/**
 * La lingua dell'utente, lato server.
 *
 * Il client la manda in `x-jm-lang` a ogni chiamata (vedi src/lib/api.ts).
 * Serve perche anche cio che SCRIVE l'AI — titolo, sintesi, aree, recap —
 * deve uscire nella lingua dell'interfaccia: un'app in inglese che genera
 * "la telefonata rimandata" e tradotta a meta, cioe rotta.
 *
 * Cosa NON cambia con la lingua: le etichette delle macro-aree restano
 * 'Lavoro' | 'Relazioni' | 'Corpo' | 'Emozioni' anche in inglese. Sono un
 * enum salvato nel database, non testo: se l'AI cominciasse a scrivere
 * 'Work' le giornate vecchie e nuove dello stesso utente finirebbero con
 * etichette diverse e nessun filtro funzionerebbe piu. A schermo le
 * traduce t(), come ogni altra parola dell'interfaccia.
 */

export type PromptLang = "it" | "en";

export function langOf(req: Request): PromptLang {
  const raw = req.headers.get("x-jm-lang");
  return raw === "en" ? "en" : "it";
}

/** Il nome della lingua da mettere nel prompt (che resta in italiano). */
export function langName(lang: PromptLang): string {
  return lang === "en" ? "inglese" : "italiano";
}
