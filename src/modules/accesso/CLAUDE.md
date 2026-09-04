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

## Face ID: la proposta vive qui (1 settembre 2026)

Face ID e OPT-IN e si propone SOLO dopo un codice a sei cifre giusto, mai
all'avvio: le regole (un si per sempre; un no ripropone al prossimo codice,
per tre volte; al terzo no il congedo che indica le Impostazioni) stanno in
`src/lib/native/face-id.ts` (scheletro), le due schermate dentro
`src/app/(app)/login/page.tsx` (fase `faceIdFase`). L'interruttore per
cambiare idea sta nel modulo impostazioni. Il lucchetto
(`src/components/biometric-lock.tsx`, scheletro) si arma solo se la scelta
e "on". Banco: `verify-bugfix-20260901` (serve `JM_MOBILE=1 npx next build`).

## Il cancello della cassaforte (3 settembre 2026, SPEC R8)

`components/cassaforte-cancello.tsx` (prefisso `jm-login-cassa`, mockup
`design/mockups/codice-di-recupero.html` 01-02), montato dallo scheletro
(AuthGate) in cloud quando la cassaforte non e aperta su questo dispositivo:

- `ParoleNuove`: le otto parole, UNA volta. Screenshot consigliato per
  primo, tasto Copia, casella "le ho salvate" che accende il tasto (scelta di
  Manuel dopo il controaudit). Nessuna X. Il cancello resta finche non si
  preme "Ho capito, continua" (`passaCancello()` in src/lib/cassaforte).
- `ChiediParole`: il dispositivo senza chiave. Dice quante giornate ci sono e
  da quando (giorno e conteggio sono in chiaro), segnala QUALE parola non
  esiste prima di provare, accetta maiuscole, accenti, numeri davanti e
  troncamenti di almeno quattro lettere. "Non ho il codice" dice le tre
  strade vere e "Ricomincia da zero" e a due passi.

La logica sta tutta in `src/lib/cassaforte/` (scheletro): qui solo le
schermate. Banco: `verify-cassaforte`.

## L'ospite: la parte che non si vede (notte del 3 settembre 2026, branch `ospite-server`)

SPEC-ospite-e-cassaforte R1-R4, pezzo 3. CODICE FATTO solo per cio che non
si vede; le SCHERMATE (primo avvio dritto su Oggi, avviso discreto, muro
della quota, riga in Impostazioni) aspettano l'ok di Manuel sul mockup
`design/mockups/ospite-primo-avvio.html`. Referto della notte:
`REFERTO-ospite-notte.md`; mappa del codice: `REFERTO-ospite-mappa.md`.

- L'INTERRUTTORE: `src/lib/ospite/flag.ts` (scheletro). Di fabbrica SPENTO:
  l'app si comporta come prima (login al primo avvio, locale a zero AI). I
  banchi lo accendono con localStorage `jm.ospite = "1"`. Quando le
  schermate saranno approvate si porta `OSPITE_DI_FABBRICA` a true.
- Con l'interruttore acceso, AuthGate (scheletro) al primo avvio sceglie da
  solo la modalita locale e fa nascere il braccialetto
  (`src/lib/ospite/braccialetto.ts`: 32 byte casuali nel portachiavi iCloud
  via Cassaforte.swift, conto "braccialetto"; IndexedDB sul web). `can()`
  accende voce e riassunto in locale. Le route AI ricevono il braccialetto
  nell'intestazione `x-jm-braccialetto` (apiFetch) e la guardia
  `requireOspiteOPremium` (src/lib/server/ospite.ts) conta la quota SUL
  server (migration 023). Un 402 `regalo_finito` NON apre il muro premium:
  apiFetch lancia l'evento `jm:regalo-finito`, e il muro della quota
  (schermata 03 del mockup) e da fare.
- Route di questo modulo: `server/ospite-stato.ts` -> GET /api/ospite/stato
  (usate, rimaste, oggi coperta; non crea e non spende). E la sorgente della
  futura riga "AI in regalo" in Impostazioni.
- Banco: `verify-ospite` (46 controlli, con Supabase e OpenAI finti lato
  server: scripts/lib/finti-server.mjs). `verify-pr10` misura la promessa
  nuova del par. 5 (scripts/lib/promessa-ospite.mjs) con l'interruttore
  spento.

## L'email dopo, non prima (4 settembre 2026, branch `premium-senza-password`)

Mockup `design/mockups/premium-senza-password.html` (D1, C1). La pagina
`/login` non e piu un bivio: via "Tienilo solo su questo dispositivo" (l'ospite
E gia solo sul dispositivo), titolo "Le tue giornate, anche altrove.",
un campo, "Non ora" che torna indietro. Chi arriva dalla modalita locale
lascia il promemoria `jm.migrazione.locale` (`segnaMigrazioneDaFare`); il
cancello (`src/components/auth-gate.tsx`), appena la cassaforte e aperta,
chiama `migraSePromesso()` (`src/lib/ospite/migrazione.ts`): POST
`/api/ospite/adotta` (`server/ospite-adotta.ts`: lega il braccialetto e
sposta il premium comprato senza email sul profilo, funzione SQL
`adotta_braccialetto`, migration 025), poi `LocalStore.exportAll()` ->
`CloudStore.importAll()`: le giornate del telefono salgono gia chiuse a
chiave. Le giornate locali non si cancellano. Banco:
`scripts/verify-ospite-schermate.mjs` sezione 06.
