/**
 * Il prezzo del premium, in UN posto solo (SPEC-v2 §10.1).
 * Deciso da Manuel il 19 ago 2026: 4,99 EUR al mese.
 * Il prezzo VERO lo detta Stripe (STRIPE_PRICE_ID): questa etichetta e
 * solo cio che l'utente legge sul bottone — se cambia il price su Stripe
 * va cambiata anche qui.
 */
export const PREMIUM_PRICE_LABEL = "4,99 € al mese";
