/**
 * Il prezzo del premium, in UN posto solo (SPEC-v2 §10.1).
 * Deciso da Manuel il 19 ago 2026: 4,99 EUR al mese.
 * Il prezzo VERO lo detta Stripe (STRIPE_PRICE_ID): queste etichette sono
 * solo cio che l'utente legge — se cambia il price su Stripe vanno
 * cambiate anche qui.
 */

/** Solo la cifra, per i punti dove va in evidenza tipografica. */
export const PREMIUM_PRICE_AMOUNT = "4,99 €";

/** La cadenza, staccata dalla cifra per lo stesso motivo. */
export const PREMIUM_PRICE_PERIOD = "al mese";

/** La frase intera, per i bottoni. */
export const PREMIUM_PRICE_LABEL = `${PREMIUM_PRICE_AMOUNT} ${PREMIUM_PRICE_PERIOD}`;

/**
 * Prova gratuita: NON esiste. `/api/stripe/checkout` crea una sessione
 * subscription senza `trial_period_days`, quindi si paga dal primo giorno.
 * La spec §10.1 parlava di "primo mese incluso" come segnaposto e la
 * decisione non e mai stata presa: finche questa costante e false, nessuna
 * schermata puo promettere un mese gratis (lo faceva /benvenuto, ed era una
 * bugia). Se un giorno il trial si attiva su Stripe, si accende qui e si
 * aggiunge `subscription_data.trial_period_days` nel checkout.
 */
export const PREMIUM_HAS_FREE_TRIAL = false;
