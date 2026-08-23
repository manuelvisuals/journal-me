# Modulo RICORDA

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Ricorda: persone, luoghi, todo, note e idee, la quick capture e la scheda
persona. Pagine: `src/app/remember/` e `src/app/persona/`.

- Prefissi CSS (misurati): `jm-rem`, `jm-pers`, `jm-qc`.
- La porta esporta QuickCapture (la usa Oggi in /giorno per aggiungere).
- Banchi prima del push: `verify-pr8`, `verify-persona-moduli` (piu tsc,
  eslint, verify-i18n).
