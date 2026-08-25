/**
 * La porta del modulo ACCESSO (passo D, ARCHITETTURA.md). Da qui esce solo
 * cio che lo scheletro deve montare: mai importare @/modules/accesso/*
 * dall'esterno, il lint dei confini lo blocca.
 */
export { Linguetta } from "@/modules/accesso/components/linguetta";
export { SalutoAvvio } from "@/modules/accesso/components/saluto-avvio";
