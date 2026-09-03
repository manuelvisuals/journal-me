/**
 * La porta del modulo OGGI (passo D, ARCHITETTURA.md): cio che gli ALTRI
 * moduli possono importare. Tutto il resto e interno: il lint dei confini
 * blocca gli import di @/modules/oggi/* da fuori.
 */
export { RecordingOverlay } from "@/modules/oggi/components/recording-overlay";
/* Lo sfogliare col dito. Nasce qui perche il primo cliente era la
   giornata, ma il gesto non sa niente di giornate: sa solo "prima" e
   "dopo" e dove sta il muro. Dal 30 agosto 2026 lo usa anche il Mese a
   griglia, che con lui cambia mese. Passa dalla porta come
   RecordingOverlay: e la regola della casa per i pezzi condivisi
   (ARCHITETTURA.md, passo D). Se un giorno spuntasse un quarto cliente,
   allora tocchera promuoverlo a primitiva di scheletro e dargli un nome
   che non dica "day".
   NOTA per chi lo monta: il suo CSS (.jm-day-sw) vive in
   src/modules/oggi/styles.css, che globals.css importa sempre. */
export { DaySwipe } from "@/modules/oggi/components/day-swipe";
/* Il foglio "giornata modificata altrove" (SPEC R7): montato UNA volta dal
   guscio, si apre da solo a ogni conflitto di versione. */
export { ConflittoGiornata } from "@/modules/oggi/components/conflitto-giornata";
