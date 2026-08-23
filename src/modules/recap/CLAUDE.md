# Modulo RECAP

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

I recap letterari (mensili, semestrali, annuali): lista, dettaglio, editor.
Pagina: `src/app/recap/`; la generazione passa da `src/app/api/recap/generate`
(la logica AI si discute con Manuel prima).

- Prefissi CSS (misurati): `jm-recap`, `jm-det`, `jm-gen`, `jm-period`, `jm-drop`.
- Banchi prima del push: tsc, eslint, verify-i18n (un banco dedicato ancora
  non esiste: se lo scrivi, chiamalo `verify-recap.mjs` e provalo a mordere).
- Le API del modulo (passo E): `src/modules/recap/server/generate.ts`; la route
  in `src/app/api/recap/generate/` e un guscio.
