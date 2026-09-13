# Modulo ADMIN

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Il pannello delle impostazioni globali dell'app: `dayalogue.com/admin`.
Entra UN account solo (`madh52@gmail.com`), e il controllo vero sta sul
server (`server.ts`, `requireAdmin`): a chiunque altro la rotta risponde
404 e la pagina non disegna niente. Prima schermata: le Aree (tabella
`aree`, migration 015). Mockup approvato: `design/mockups/admin.html`
(ramo `worker-admin-mockup`).

LA REGOLA PIU IMPORTANTE: questo modulo SCRIVE le aree ma non le presta a
nessuno. Chi le legge (`oggi`, `recap`, le schermate) passa dal contratto
dello scheletro: `src/lib/aree.ts` (tipo e rete di sicurezza),
`src/lib/server/aree.ts` (`leggiAree`, lato server),
`src/lib/aree-client.ts` (`useAree`, lato client). Se il pannello sparisse
domani, il diario non se ne accorgerebbe: e la direzione giusta della
dipendenza.

Cosa il pannello NON fa, per contratto (le decisioni sono di Manuel):
- non cambia mai la `chiave` di un'area esistente: e l'identita scritta
  dentro le giornate salvate. Si rinomina il `nome`, mai la chiave;
- non cancella: un'area si spegne (`attiva=false`). La rotta non ha DELETE;
- le scritture passano SOLO dal service role (la tabella non ha policy di
  scrittura): mai dal client Supabase.

- Pagine di `src/app/` di questo modulo: `(app)/admin/` (guscio),
  `api/admin/aree/` (guscio della rotta).
- Prefisso CSS: `jm-adm`.
- Banchi prima del push: `verify-aree` e `verify-i18n` (piu tsc, eslint).

## Regalo AI (notte del 3 settembre 2026, branch `ospite-server`): solo la rotta

SPEC R4. `server/regalo.ts` -> GET/PUT /api/admin/regalo (guscio in
`src/app/api/admin/regalo/route.ts`): l'interruttore, le giornate per
ospite, il tetto mensile in euro, il cambio USD->EUR, e lo speso del mese
(funzione SQL `riassunto_regalo_mese`, leggibile solo col service role).
Dopo ogni PUT chiama `dimenticaRegalo()` (src/lib/server/regalo.ts) cosi la
guardia rilegge subito. La tabella `regalo` (migration 023) e a una riga,
pubblica in lettura, senza policy di scrittura. La SCHERMATA "Regalo AI"
(mockup `design/mockups/ospite-primo-avvio.html`, 05) prende il posto del
segnaposto "Piani e limiti" ed e da fare dopo l'ok di Manuel. Il contratto
dei limiti e nello scheletro (`src/lib/regalo.ts`), come per le aree.

La SCHERMATA e fatta il 4 settembre 2026 (branch `ospite-schermate`,
mockup approvato): `components/regalo-schermata.tsx`, voce "Regalo AI"
nella rail al posto di "Piani e limiti". Interruttore del regalo, giornate
per ospite, tetto mensile, speso del mese (sola lettura, con la barra) e
l'interruttore "Annuale in vendita" (migration 024). Si salva con UNA
scrittura (PUT), "Annulla" rimette la bozza. Banco:
`scripts/verify-ospite-schermate.mjs` (05).

## Iscritti (13 settembre 2026, branch `admin-iscritti`)

Mockup `design/mockups/admin-iscritti.html` (v2, dopo il controaudit e il
polish; scelte di Manuel A2 B2 C2). `server/iscritti.ts` -> GET/PUT
/api/admin/iscritti (guscio in `src/app/api/admin/iscritti/route.ts`).
Il GET legge auth.users (listUsers, a pagine), profiles, braccialetti,
braccialetto_giornate, regalo, e CONTA entries + cassettine e somma
ai_usage del mese: tutto col service role, aggregato in JS (le tabelle
sono piccole; a migliaia di iscritti si passa a una funzione SQL). Il
contenuto delle giornate non si vede mai: e cifrato sul telefono.
Il PUT scrive plan + plan_source = 'manual' (o free) e RIFIUTA con 409 un
piano che governa Apple. `components/iscritti-schermata.tsx`: segmented
Account/Ospiti, quattro numeri, elenco ordinabile cliccando le
intestazioni (crescente, poi decrescente; di fabbrica ultimo iscritto in
cima), ricerca, ispettore a destra con il piano. Prefisso CSS
`jm-adm-isc-*`. Banco: `scripts/verify-iscritti.mjs` (il finto serve
`/auth/v1/admin/users` da `sb.accountAuth`).

## Recensione (13 settembre 2026, branch `recensione`)

Mockup `design/mockups/admin-iscritti.html`, sezione 04. Il foglio delle
stelle di Apple e gia nel binario (`ios/App/App/Recensione.swift`, dalla
build 4) ma DORME: lo sveglia la riga `recensione` (migration 030), che
questo pannello scrive (`server/recensione.ts` -> GET/PUT
/api/admin/recensione) e che l'app legge una volta al giorno da
`GET /api/recensione` (scheletro: `src/lib/server/recensione.ts`, cache
30 s; `src/lib/recensione.ts` la regola sul telefono; il gancio e in
`modules/oggi` a giornata chiusa). Il contatore `recensione_richieste`
conta le volte in cui un'app ha CHIESTO il foglio: se e comparso e se la
persona ha scritto, Apple non lo dice. Schermata
`components/recensione-schermata.tsx`, prefisso `jm-adm-rec-*` (riusa i
riquadri `jm-adm-isc-box`). Banco: `scripts/verify-recensione.mjs`.
