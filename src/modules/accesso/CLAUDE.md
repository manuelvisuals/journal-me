# Modulo ACCESSO

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Login con codice via email e la scelta iniziale delle due modalita in
/benvenuto. Qui non ci sono componenti: le pagine vive stanno in
`src/app/login/` e `src/app/benvenuto/` (con un CLAUDE.md di rimando), e il
flusso auth server-side (`src/app/auth/`, `src/lib/supabase/`) e scheletro.

- Prefissi CSS: `jm-benv`; per classi nuove del login il prefisso e `jm-login`.
- Banco prima del push: `verify-pr10` — il locale non fa MAI rete, e la
  promessa piu importante dell'app (piu tsc, eslint, verify-i18n).
