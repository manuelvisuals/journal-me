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
sposta sul profilo un eventuale premium comprato senza email, funzione SQL
`adotta_braccialetto`, migration 025 — dal 10 settembre 2026 premium senza
email non si compra piu, quindi quel passaggio serve solo a restituire cio
che qualcuno aveva comprato prima), poi `LocalStore.exportAll()` ->
`CloudStore.importAll()`: le giornate del telefono salgono gia chiuse a
chiave. Le giornate locali non si cancellano. Banco:
`scripts/verify-ospite-schermate.mjs` sezione 06.

## Il saluto dopo il logout (8 settembre 2026)

Chi preme "Esci dall'account" torna ospite in modalita locale senza
ricaricare: per il saluto era un primo avvio, e la lettera si apriva
prima della schermata di login. Ora il logout scrive `jm.saluto.uscito`
(`segnaUscita`, dalla vedetta onAuthStateChange su SIGNED_OUT); in
modalita locale con quella memoria il saluto non si apre, e sulle pagine
pubbliche il velo non si disegna. La memoria cade al prossimo accesso
vero (`dimenticaUscita` dentro `identita()`): "logout riporta alla prima
visualizzazione" vale per chi rientra. Un dispositivo davvero nuovo lo
vede ancora. Banco: `verify-saluto-logout` (10 controlli, morso provato).

## La linguetta Feedback non c'e per il revisore (9 settembre 2026)

Sull'account di revisione Apple (email che inizia per `appreview@`) la
linguetta sul bordo destro non si monta: `revisore.ts` (`useRevisore`,
legge la sessione in tasca, niente rete; da ospite e sempre falso) e una
riga in `components/linguetta.tsx`. Il saluto senza bersaglio ha gia la
chiusura secca. Banco: `verify-linguetta-revisore` (6 controlli, morso
provato).

## Il braccialetto nasce con DeviceCheck, la giornata e quella del diario (10 settembre 2026, branch `modello-premium`)

Audit del modello premium (AUDIT-premium-vuole-account.html), decisioni 2A e
4A di Manuel.

- Il server NON crea piu un braccialetto per qualunque segreto: nasce solo
  da POST /api/ospite/braccialetto (`server/ospite-braccialetto.ts` ->
  `registraBraccialetto` in src/lib/server/ospite.ts, scheletro). Con
  DeviceCheck acceso (variabili `APPLE_DEVICECHECK_*`, vedi
  `DEVICECHECK-passi.md`) vuole il token del guscio (`ios/App/App/DeviceCheck.swift`,
  `src/lib/native/devicecheck.ts`) e il bit "regalo gia dato" spento presso
  Apple. Sul web niente token: 403 `solo_app`, e l'AI risponde 402
  `regalo_finito` motivo `solo_app`; il muro dice "si accende dall'app".
  Spento (banchi, sviluppo, e produzione finche Manuel non carica la chiave)
  il server registra e basta. `assicuraBraccialetto` registra all'avvio, una
  volta per apertura, in fila (due effetti di AuthGate creavano DUE segreti).
- `x-jm-giorno` = il giorno del DIARIO su cui l'AI lavora (apiFetch, opzione
  `giorno`; lo mandano save-recording, analyze-day, chiarimenti, scan-archivio);
  il server lo accetta solo se plausibile (non nel futuro oltre un giorno,
  non piu vecchio di un anno, esistente) e ogni giornata ha un tetto di
  chiamate (`CHIAMATE_PER_GIORNATA` = 60, migration 028 `chiamate`): oltre,
  402 motivo `chiamate`.
- `/api/ospite/stato` risponde anche `registrato`; la riga "AI in regalo"
  dice "nell'app per iPhone" quando e falso.
- 400 e 401 di Apple NON sono la stessa cosa (10 settembre 2026, provando la
  chiave in produzione): 400 e il token del telefono, 401 e la NOSTRA chiave.
  Confusi, una chiave sbagliata su Vercel avrebbe tolto il regalo a ogni
  iPhone in silenzio. Adesso 401 e `non_disponibile` (503, riprova), e la
  differenza e il modo di verificare la chiave da fuori: un token inventato
  deve dare 403 `token_non_valido`; se da 503, la chiave non vale
  (`DEVICECHECK-passi.md` par. 4).
- Banchi: `verify-ospite` (55, con la sezione 4A/2A), `verify-devicecheck`
  (22, con il DeviceCheck finto di scripts/lib/finti-server.mjs, che sa
  fingere anche la chiave rotta: `dc.chiaveRotta = true`; il dev server va
  rilanciato con `APPLE_DEVICECHECK_BASE_URL=http://127.0.0.1:3196`).

## La porta del giorno, il bivio che non c'e piu (10 settembre 2026, branch `modello-premium`)

Decisioni B1, 5A, C4, B5 e punto 7 del modello premium (audit del 10
settembre; Manuel: "vai, facciamo tutto").

- `components/porta-giorno.tsx` ha preso il posto di `saluto-avvio.tsx` e del
  foglio "presentazione" del muro: UNA schermata all'ingresso, una volta al
  giorno. La logica (quale variante: lettera, cambiata, uguale, finite, pausa,
  proposta, niente) e in `porta-stato.ts`, pura, banco
  `verify-porta-stato` (`node --experimental-strip-types`, 19 controlli). Le
  memorie sono `jm.porta.lettera` (versione vista), `jm.porta.giorno` (giorno
  locale del dispositivo), `jm.porta.rimaste` (conto detto l'ultima volta).
  `saluto-stato.ts` resta per la vedetta del logout (`jm.saluto.uscito`) e
  per il gancio dei banchi (`jm.saluto.silenzio` valido = porta muta).
- La lettera (primo avvio): nel guscio il regalo in testa ("N giornate, con
  l'AI accesa", "Comincia a scrivere") e sotto la lettera di Manuel dal
  pannello; sul web solo la lettera. In locale la riga "Ho gia un account"
  -> /login. Il campo `bottone` del pannello non comanda piu il tasto. Niente
  casella "non mostrare piu": una volta per dispositivo e per versione.
- Le mattine: "Ti restano N" con i pallini quando il conto e cambiato (o
  restano 2 o meno); il GIORNO come titolo e il conto in piccolo quando e
  uguale a ieri (5A); "finite"; "in pausa" con le giornate che restano (C4);
  "proposta" per un account gratis senza regalo qui (il web). "Passa a
  premium" chiude la porta e apre il muro. Premium: niente.
- Il bivio `/app/benvenuto` e un rimando a /app; `src/lib/welcome.ts` e
  `components/differenze.tsx` non esistono piu; `afterLogin` porta su /app e
  il muro si riapre da solo se si era partiti da li (`src/lib/ospite/muro-riapri.ts`,
  letto da AuthGate, cancellato da "Non ora").
- Banchi: `verify-porta-giorno` (35, browser), `verify-benvenuto` (65,
  riscritta la sezione della casella), `verify-saluto-logout` (10),
  `verify-linguetta-revisore` (6), `verify-appstore` (22, riscritto).
