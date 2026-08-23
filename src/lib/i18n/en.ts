/**
 * Il catalogo inglese: l'UNIONE dei cataloghi per modulo (passo C,
 * ARCHITETTURA.md, 23 agosto 2026). Le voci non vivono piu qui: stanno in
 * src/lib/i18n/catalogs/<modulo>.ts, e ogni chat scrive SOLO nel file del
 * suo modulo. Le frasi condivise stanno in catalogs/comune.ts (scheletro).
 *
 * REGOLE DI TRADUZIONE, non gusto personale:
 *  - stesso tono dell'italiano: diretto, minuscolo dove l'italiano e
 *    minuscolo, niente maiuscole di stile inglese sui bottoni;
 *  - niente punto finale se l'italiano non ce l'ha;
 *  - i nomi propri dell'app non si traducono: Journal.me, Recap, Premium;
 *  - "Ricorda" e il nome di una schermata: diventa "Remember";
 *  - i micro-goal di default NON sono qui: vivono nel database e sono
 *    scritti dall'utente.
 *
 * `scripts/verify-i18n.mjs` fallisce se una chiave e definita in DUE
 * cataloghi, se una frase passata a t() non ha traduzione, o se una
 * traduzione e rimasta orfana.
 */
import { COMUNE } from "@/lib/i18n/catalogs/comune";
import { OGGI } from "@/lib/i18n/catalogs/oggi";
import { MESE } from "@/lib/i18n/catalogs/mese";
import { RICORDA } from "@/lib/i18n/catalogs/ricorda";
import { RECAP } from "@/lib/i18n/catalogs/recap";
import { IMPOSTAZIONI } from "@/lib/i18n/catalogs/impostazioni";
import { ACCESSO } from "@/lib/i18n/catalogs/accesso";
import { ABBONAMENTO } from "@/lib/i18n/catalogs/abbonamento";
import { PALESTRA } from "@/lib/i18n/catalogs/palestra";

export const EN: Record<string, string> = {
  ...COMUNE,
  ...OGGI,
  ...MESE,
  ...RICORDA,
  ...RECAP,
  ...IMPOSTAZIONI,
  ...ACCESSO,
  ...ABBONAMENTO,
  ...PALESTRA,
};
