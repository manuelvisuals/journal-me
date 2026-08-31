# Modulo ACCESSO

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Login con codice via email e la scelta iniziale delle due modalita in
/benvenuto. Qui non ci sono componenti: le pagine vive stanno in
`src/app/(app)/login/` e `src/app/(app)/app/benvenuto/` (con un CLAUDE.md di rimando), e il
flusso auth server-side (`src/app/(app)/auth/`, `src/lib/supabase/`) e scheletro.

Da qui esce anche il **saluto all'avvio** (`components/saluto-avvio.tsx`
piu `saluto-stato.ts`), montato dallo scheletro dentro AuthGate via la porta
`index.ts`. La memoria e in tre posti e ognuno ha il suo motivo, scritti in
testa a `saluto-stato.ts`: variabile di modulo per "una volta per apertura",
localStorage per il contatore e per il silenzio. La soglia della casella e
`APRI_CASELLA_DALLA`. La grafica e provvisoria per scelta: e solo l'impianto.

- Prefissi CSS: `jm-benv` (il saluto usa `jm-benv-sal`); per classi nuove del login il prefisso e `jm-login`.
- Banco prima del push: `verify-pr10` — il locale non fa MAI rete, e la
  promessa piu importante dell'app (piu tsc, eslint, verify-i18n).
