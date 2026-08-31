/**
 * LA PORTA del modulo SITO.
 *
 * Da qui passa SOLO cio che serve a un ALTRO modulo (il lint dei confini e
 * a errore, ARCHITETTURA.md), e oggi e una cosa sola: il pannello SEO, che
 * il modulo ADMIN monta come seconda voce del suo pannello.
 *
 * Le pagine pubbliche (`src/app/page.web.tsx`, `/en`, `/support`) NON
 * passano da qui: sono i gusci di questo modulo, come `src/app/(app)/app/
 * mese/page.tsx` lo e del modulo mese, e importano direttamente cio che
 * gli serve. La ragione e concreta: quelle pagine sono componenti SERVER e
 * tirano dentro il lettore del database, mentre questa porta viene
 * importata da un componente CLIENT (il pannello dentro /admin). Mettere
 * le due cose nello stesso file vorrebbe dire spedire il lettore del
 * database dentro il pacchetto del browser.
 */

export { PannelloSeo } from "@/modules/sito/components/pannello-seo";
