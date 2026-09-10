/**
 * La porta del modulo ACCESSO (passo D, ARCHITETTURA.md). Da qui esce solo
 * cio che lo scheletro deve montare: mai importare @/modules/accesso/*
 * dall'esterno, il lint dei confini lo blocca.
 */
export { Linguetta } from "@/modules/accesso/components/linguetta";
export { PortaGiorno } from "@/modules/accesso/components/porta-giorno";
export { CassaforteCancello, ParoleNuove } from "@/modules/accesso/components/cassaforte-cancello";
export { SegnoDayalogue } from "@/modules/accesso/components/segno";
