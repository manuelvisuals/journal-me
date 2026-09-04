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
 * Prova gratuita SUL WEB: NON esiste, perche sul web non si compra (dal 4
 * settembre 2026 il muro rimanda all'App Store; il codice Stripe resta
 * inerte e senza `trial_period_days`). Finche questa costante e false,
 * nessuna schermata web puo promettere una prova.
 *
 * Su iPhone la prova esiste ed e di Apple: PREMIUM_PROVA_GIORNI sotto e
 * cio che le schermate dicono quando non possono leggere il negozio (il
 * muro del web che rimanda all'app); dentro il guscio la verita la dice
 * StoreKit, prodotto per prodotto (provaGiorni, provaDisponibile).
 */
export const PREMIUM_HAS_FREE_TRIAL = false;

/** La prova gratis su iPhone, come configurata su App Store Connect (decisione di Manuel: 14 giorni, uguale per tutti). */
export const PREMIUM_PROVA_GIORNI = 14;

/**
 * iOS v1: il premium GRATIS dentro il guscio (27 agosto - 4 settembre 2026)
 * e SPENTO: al suo posto c'e l'acquisto vero (In-App Purchase, modulo
 * abbonamento, `negozio-ios.ts`). La rotta /api/premium-v1 risponde 404 e
 * la card di /benvenuto non regala piu niente. I profili `ios-v1` hanno un
 * mese di premium dalla migration 024, poi scadono da soli.
 */
export const PREMIUM_IOS_V1_GRATIS = false;

/**
 * I PRODOTTI DELL'IN-APP PURCHASE (decisi da Manuel il 4 settembre 2026).
 * I nomi sono quelli creati su App Store Connect e NON si cambiano mai: il
 * mensile si chiama cosi per sempre; l'annuale e un SECONDO prodotto, che
 * puo esistere su Apple e restare nascosto nell'app finche l'interruttore
 * `regalo.annuale_attivo` (pannello admin) e spento.
 */
export const PRODOTTI_IOS = {
  mensile: "com.manuelvisuals.journalme.premium.mensile",
  annuale: "com.manuelvisuals.journalme.premium.annuale",
} as const;

export type ProdottoIos = keyof typeof PRODOTTI_IOS;

/**
 * Il bundle id dell'app iOS: il server lo pretende su ogni ricevuta ed e
 * il `bid` del gettone con cui parla con Apple. E quello VERO del progetto
 * Xcode e di App Store Connect (capacitor.config.ts, project.pbxproj):
 * `com.manuelvisuals.dayalogue`. Il 4 settembre 2026 c'era scritto
 * "com.manuelvisuals.journalme" (preso da un appunto vecchio di HANDOVER),
 * e Apple rispondeva 401 a ogni gettone: un bundle id che il team non ha
 * e un gettone non valido. I NOMI DEI PRODOTTI restano
 * com.manuelvisuals.journalme.premium.*: sono etichette, non il bundle.
 */
export const BUNDLE_ID_IOS = "com.manuelvisuals.dayalogue";

/**
 * La pagina dell'App Store, per il muro del web ("Scarica dayalogue per
 * iPhone"). Vuota finche l'app non esiste su App Store Connect: il tasto
 * allora porta al sito (/), che e la cosa piu onesta che abbiamo.
 */
export const APP_STORE_URL = "";
