# Modulo OGGI

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

La giornata: racconto a voce/scritto, editor, overlay di registrazione,
giornata raccontata (FilledView), metriche, obiettivi, chiarimenti, e la
schermata /giorno di una data scelta. Pagine che lo montano:
`src/app/page.tsx` e `src/app/giorno/`.

Cambiare giorno (29 agosto 2026, mockup `design/mockups/navigazione-giorno.html`,
variante A): `day-nav.tsx` e la testata con le frecce (due piani: "Oggi",
"Ieri", "Mercoledi" sopra, la data sotto; il centro apre
`date-picker-popover.tsx`), `day-swipe.tsx` e lo stesso cambio col dito.
LA REGOLA: il passato si sfoglia senza fondo, il futuro no — su oggi la
freccia avanti e spenta, il dito rimbalza e una riga lo spiega. Mentre il
dito va di lato la pagina si FERMA (no allo scorrimento sul touchmove piu
una rete di sicurezza che la riporta alla sua altezza): senza, la giornata
scivolava anche su e giu e il gesto sembrava scivoloso. Su /giorno
si sfoglia SENZA cambiare pagina (i due vicini si leggono in anticipo e
l'indirizzo si aggiorna con replaceState); arrivare a oggi porta a "/",
che e la casa di oggi. Da Oggi si va a ieri con un cambio di schermata:
quella schermata sa fare una data sola, e farle cambiare data vorrebbe
dire riscrivere l'editor e la registrazione.

- Prefissi CSS (misurati): `jm-ed`, `jm-editor`, `jm-fv`, `jm-rec`, `jm-day`
  (compresi i nuovi `jm-day-nav-*` e `jm-day-sw-*`),
  `jm-area`, `jm-metric`, `jm-stepper`, `jm-rm`, `jm-goal*`, `jm-write`,
  `jm-add`, `jm-ptt`, `jm-ch`. In dubbio: grep nei componenti.
- La porta esporta RecordingOverlay (lo usa Ricorda per la cattura a voce).
- Orchestrazione del salvataggio: `src/lib/actions/save-recording.ts`
  (scheletro: si cambia solo d'accordo con Manuel).
I chiarimenti (31 agosto 2026, mockup `design/mockups/chiarimenti-multi.html`):
una domanda sulle PERSONE accetta piu risposte — "i miei amici" possono
essere Hoda e Liana, e sceglierne una sola era far scrivere al diario una
cosa falsa. La casella davanti alla risposta e quadrata quando se ne puo
prendere piu di una e tonda quando no: e l'unico segnale che arriva prima
del tocco. Le risposte che dicono il contrario ("non e una persona", "non
c'entra con nessuna sfera") spengono le altre. Sotto ci sta lo scheletro:
`Alias.labelKeys` e un ELENCO, e i due nomi stanno nella stessa casella
`label_key` separati da U+001F — nessuna migrazione, le righe vecchie si
leggono come un elenco di uno.
L'estratto del racconto c'e SEMPRE: `citazione.ts` lo ritaglia dal testo
quando il modello lo lascia vuoto (o quando scrive una frase che nel
racconto non c'e, cioe se l'e inventata), e la schermata va a riprendere il
racconto della giornata per le domande vecchie in coda. Il codice non
inventa mai: copia.

- Banchi prima del push: `verify-chiarimenti`, `verify-chiarimenti-vivo`,
  `verify-pr7`, `verify-testo-giorno`, `verify-aree`,
  `verify-icone-aree`, `verify-titolo-vivo`, `verify-titolo-luoghi`,
  `verify-giornata-larghezze`, `verify-analisi-testo-re`,
  `verify-nav-giorno`, `verify-barra-alto` (piu tsc, eslint,
  verify-i18n).
  Attenzione: `verify-icone-aree` e `verify-giornata-larghezze` hanno la
  porta 3200 scritta dentro, gli altri usano la 3100 (JM_BASE).
- Le API del modulo (passo E): `src/modules/oggi/server/` — chiarimenti,
  process-entry, extract-facts, split-by-date, transcribe-fallback. Le route in
  `src/app/api/` sono gusci e non si toccano.

La barra in alto (30 agosto 2026, scheletro): il nome della schermata e il
pallino dell'account NON stanno piu nell'intestazione di questo modulo, ma
in `src/components/ui/app-bar.tsx`, montata una volta sola dal guscio. Non
rimontare `AccountMenu` qui: `verify-barra-alto` diventa rosso.
