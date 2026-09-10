/**
 * La porta del modulo ACCESSO (passo D, ARCHITETTURA.md). Da qui esce solo
 * cio che lo scheletro deve montare: mai importare @/modules/accesso/*
 * dall'esterno, il lint dei confini lo blocca.
 */
export { Linguetta } from "@/modules/accesso/components/linguetta";
export { SalutoAvvio } from "@/modules/accesso/components/saluto-avvio";
export { CassaforteCancello, ParoleNuove } from "@/modules/accesso/components/cassaforte-cancello";
// Il bivio corto di /benvenuto ha un foglio "vedi tutte le differenze":
// stesso elenco per la schermata e, domani, per le Impostazioni.
export {
  ElencoDifferenze,
  FoglioDifferenze,
  RIGHE_DIFFERENZE,
  type RigaDifferenza,
} from "@/modules/accesso/components/differenze";
export { SegnoDayalogue } from "@/modules/accesso/components/segno";
