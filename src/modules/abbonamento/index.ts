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
