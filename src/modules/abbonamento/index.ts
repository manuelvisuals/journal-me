/**
 * La porta del modulo ABBONAMENTO (passo D, ARCHITETTURA.md): cio che gli
 * ALTRI moduli possono importare. Il muro premium e IL pezzo condiviso di
 * questo modulo: chiunque puo aprirlo, nessuno deve sapere come e fatto.
 */
export {
  openPremiumWall,
  closePremiumWall,
  PremiumWall,
  type WallFeature,
} from "@/modules/abbonamento/components/premium-wall";
export { PremiumWelcome } from "@/modules/abbonamento/components/premium-welcome";
export { startPremiumV1 } from "@/modules/abbonamento/premium-v1";
// Il negozio di Apple (In-App Purchase): Impostazioni usa queste tre e basta.
export {
  gestisciAbbonamento,
  negozioDisponibile,
  ripristinaAcquisti,
} from "@/modules/abbonamento/negozio-ios";
// La vetrina, per chi deve solo DIRE il prezzo senza vendere: il bivio di
// /benvenuto scrive la riga sotto il tasto con quello che dice Apple
// (prezzo gia nella valuta della persona, prova solo se le spetta davvero).
export {
  precaricaProdotti,
  prodottiInTasca,
  prodottiPremium,
  type ProdottoNegozio,
} from "@/modules/abbonamento/negozio-ios";
