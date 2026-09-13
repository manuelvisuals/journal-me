# Modulo MESE

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

La vista mensile: griglia dei giorni, navigazione fra mesi, rail delle
statistiche, teaser dei pattern (premium). Pagina: `src/app/(app)/app/mese/`.

Sul telefono la vista ha DUE forme: la lista (`month-section` +
`day-row`, quella di sempre) e la griglia compatta (`mese-mini`, un
quadratino per giorno colorato per umore, con la riga di anteprima sotto).
Le scambia l'icona nell'intestazione; la scelta vive in `vista.ts`
(localStorage `jm.mese.vista`). Da lg comanda `mese-grid`, la griglia grande.

- Prefissi CSS (misurati): `jm-mese`, `jm-month`, `jm-dots`, `jm-picker`.
- Banchi prima del push: `verify-pr9`, `verify-mese-nav`,
  `verify-barra-alto`, `verify-mese-riprova`, `verify-mese-riga-fissa` (piu
  tsc, eslint, verify-i18n).

La barra in alto (30 agosto 2026, scheletro): il nome della schermata e il
pallino dell'account NON stanno piu nell'intestazione di questo modulo, ma
in `src/components/ui/app-bar.tsx`, montata una volta sola dal guscio. Non
rimontare `AccountMenu` qui: `verify-barra-alto` diventa rosso.

## Il mese che non arrivava (9 settembre 2026)

Sul telefono agosto restava sui tre puntini per sempre; settembre (vuoto)
arrivava subito. La causa in `mese-client.tsx`: il mese vicino si precarica
al montaggio, e chi sfogliava mentre quella lettura era in volo faceva
scattare il `cancelled` dell'effetto, che buttava via la risposta MA
lasciava il mese fra i "gia chiesti": nessuno lo richiedeva piu. Ora la
lettura arrivata si registra sempre (solo lo smontaggio la butta via), una
lettura fallita si ritenta una volta e poi mostra "Riprova" al posto dei
puntini, e il mese fallito esce dai "gia chiesti". Banco:
`verify-mese-riprova` (10 controlli, morso provato: col vecchio codice 4
rossi, compreso lo sfoglia-mentre-arriva).

## La riga del giorno sotto la scacchiera non balla (13 settembre 2026)

Sul telefono la riga in fondo (numero, titolo, "apri la giornata") sta
appoggiata al bordo basso (`margin-top: auto`), quindi la sua altezza
decideva dove stava il bordo superiore: un titolo di una riga la alzava, uno
di due la abbassava, e cambiando giorno tutto saltava. Ora il titolo
(`.jm-mese-mini-prev .h`) riserva SEMPRE due righe e si ferma alla seconda
coi puntini (`-webkit-line-clamp: 2`), e la riga di aiuto (nessun giorno
scelto) ha la stessa altezza minima: il primo tocco non sposta niente.
Banco: `verify-mese-riga-fissa` (5 controlli, misura il `top` della riga fra
titolo corto e lungo: deve essere lo stesso pixel).
