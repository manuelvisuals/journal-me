# Modulo MESE

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

La vista mensile: griglia dei giorni, navigazione fra mesi, rail delle
statistiche, teaser dei pattern (premium). Pagina: `src/app/mese/`.

Sul telefono la vista ha DUE forme: la lista (`month-section` +
`day-row`, quella di sempre) e la griglia compatta (`mese-mini`, un
quadratino per giorno colorato per umore, con la riga di anteprima sotto).
Le scambia l'icona nell'intestazione; la scelta vive in `vista.ts`
(localStorage `jm.mese.vista`). Da lg comanda `mese-grid`, la griglia grande.

- Prefissi CSS (misurati): `jm-mese`, `jm-month`, `jm-dots`, `jm-picker`.
- Banchi prima del push: `verify-pr9`, `verify-mese-nav` (piu tsc, eslint,
  verify-i18n).
