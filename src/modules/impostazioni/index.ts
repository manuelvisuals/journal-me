/**
 * La porta del modulo IMPOSTAZIONI (passo D, ARCHITETTURA.md). Da qui esce
 * SOLO cio che serve a chi sta fuori — mai importare
 * `@/modules/impostazioni/*` dall'esterno, il lint dei confini lo blocca.
 *
 * `useFotoProfilo`: la foto del pallino. La sa cambiare questo modulo (la
 * riga "Foto profilo" e il ritaglio vivono qui), ma chi la MOSTRA e lo
 * scheletro — `AccountMenu` la disegna nell'intestazione del telefono e
 * nella rail del computer. Stesso schema del muro premium di abbonamento:
 * chiunque puo leggerla, nessuno deve sapere come e fatta.
 */
export { useFotoProfilo } from "@/modules/impostazioni/foto-profilo";
