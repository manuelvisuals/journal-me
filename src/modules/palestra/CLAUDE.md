# Modulo PALESTRA

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Il primo "modulo utente" accendibile da Impostazioni > Moduli. Oggi e lo
stato "presto" in `src/app/(app)/app/palestra/` (con un CLAUDE.md di rimando);
l'interruttore e l'ordine vivono in `src/lib/modules.ts` (scheletro).

- Prefisso CSS: `jm-gym` (oggi `jm-mod-*` per lo stato "presto").
- Banchi prima del push: `verify-persona-moduli` (piu tsc, eslint, verify-i18n).
