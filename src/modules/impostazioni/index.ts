/**
 * La porta del modulo IMPOSTAZIONI (passo D, ARCHITETTURA.md). Da qui esce
 * SOLO cio che serve a chi sta fuori — mai importare
 * `@/modules/impostazioni/*` dall'esterno, il lint dei confini lo blocca.
 *
 * Il profilo (nome e foto) lo SA cambiare questo modulo, ma chi lo MOSTRA e
 * lo scheletro: `AccountMenu` disegna il pallino nell'intestazione del
 * telefono e nella rail del computer, e la testata del menu. Stesso schema
 * del muro premium di abbonamento: chiunque puo leggere, nessuno deve
 * sapere come e fatto.
 *
 * Cosa NON esce di qui: il salvataggio. Leggere il profilo lo puo fare
 * chiunque, cambiarlo solo questo modulo.
 */
export {
  useProfilo,
  useNomeMostrato,
  apriPannelloNome,
} from "@/modules/impostazioni/profilo";
