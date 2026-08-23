# Modulo MESE

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

La vista mensile: griglia dei giorni, navigazione fra mesi, rail delle
statistiche, teaser dei pattern (premium). Pagina: `src/app/mese/`.

- Prefissi CSS (misurati): `jm-mese`, `jm-month`, `jm-dots`, `jm-picker`.
- Banchi prima del push: `verify-pr9`, `verify-mese-nav` (piu tsc, eslint,
  verify-i18n).
