# Referto della notte: l'ospite, la parte che non si vede

Notte fra il 3 e il 4 settembre 2026. Branch `ospite-server`, sei commit,
NIENTE unito in main, NIENTE eseguito sul database di produzione. Manuel
dormiva: dove mancava una decisione ho scelto il valore piu ragionevole, l'ho
reso configurabile e l'ho scritto qui (par. 3).

Da leggere insieme a: il mockup `design/mockups/ospite-primo-avvio.html`
(le schermate, in attesa del tuo ok), `SPEC-ospite-e-cassaforte.md` (R1-R4,
par. 5, 6-ter, 7), la mappa del codice `REFERTO-ospite-mappa.md`.

## 1. Cosa ho fatto, in ordine

1. **Il mockup** `design/mockups/ospite-primo-avvio.html`, nello stile di
   `codice-di-recupero.html` (font locali, telefono minimal chiaro,
   annotazioni rosse e verdi). Sei sezioni: 01 il primo avvio dritto su Oggi
   (identico a Oggi di chi e dentro, microfono acceso, pallino "questo
   telefono"); 02 l'avviso discreto quando restano poche giornate (una riga in
   card con la X, sotto la giornata chiusa, mai all'avvio; variante web con
   "scopri premium"); 03 il muro della quota finita (su iPhone SOLO "Continua
   senza AI" e "Ho gia un account", nessun prezzo; variante web con "prova
   premium"; e la giornata scritta a mano dopo il muro, salvata senza muro);
   04 la riga in Impostazioni ("Dove sono le mie giornate", "AI in regalo 7
   su 10", "Accedi al tuo account", piu il pannello "AI in regalo" e la voce
   "Dove tenere il diario" che era il bivio di /benvenuto); 05 la voce
   "Regalo AI" in /admin (interruttore, giornate per ospite, tetto mensile,
   speso questo mese) al posto del segnaposto "Piani e limiti"; 06 il come in
   parole semplici; 07 la tabella delle decisioni del par. 7 con opzioni
   numerate (A-G). Controllato reso in Chromium a 1440: zero caratteri non
   ASCII.

2. **La migration 023** (`supabase/migrations/023_ospite.sql`) e il file da
   incollare `supabase/DA-ESEGUIRE-ospite.sql` (identico, con l'intestazione).
   Tabelle: `regalo` a una riga (`check (id = 1)` come `benvenuto`: `attivo`
   true, `giornate_per_ospite` 10, `tetto_mensile_eur` 100, `cambio_usd_eur`
   0,92; lettura pubblica, nessuna scrittura), `braccialetti` (hash del
   segreto, user_id nullable per l'ospite diventato account), 
   `braccialetto_giornate` (una riga per giorno su cui l'AI ha lavorato),
   `ai_usage` con `user_id` nullable, `braccialetto_id`, `regalo` (flag: la
   chiamata l'ha pagata il regalo) e `costo_usd`, il check "uno dei due",
   tre indici (created_at, le sole righe del regalo, per braccialetto).
   Tre funzioni SQL security definer: `usa_giornata_ospite` (decide sotto
   lock di riga: ok / quota / bloccato, con `gia` per il giorno gia contato),
   `speso_regalo_mese`, `riassunto_regalo_mese`. Provata DUE volte di fila su
   un Postgres 16 locale (shim di `auth.users` e `auth.uid()`), piu una prova
   funzionale delle tre funzioni (quota che finisce, giorno gia contato che
   passa anche sopra il tetto, blocco delle giornate nuove, check che morde
   su una riga senza chiamante). Idempotente: `if not exists`, `drop policy
   if exists`, `or replace`, revoke condizionali sui ruoli Supabase (che su
   un Postgres qualunque non esistono).

3. **Il server.** `src/lib/regalo.ts` (contratto dei limiti e valori di
   fabbrica, come `aree.ts`), `src/lib/server/regalo.ts` (lettura con cache
   di 30 s, spesa del mese con cache di 60 s aggiornata a ogni log,
   `dimenticaRegalo()`), `src/lib/server/ospite.ts` (la quarta guardia
   `requireOspiteOPremium`, `statoOspite`), `src/lib/server/openai.ts`
   (`openaiUrl()`), `logAiUsage` con braccialetto/regalo/costo_usd. Sei route
   dalla guardia nuova: transcribe-fallback (GET di warm-up con
   `consuma: false`), process-entry, split-by-date, extract-facts,
   chiarimenti, classify. **Recap resta `requirePremium`.** Route nuove:
   `GET /api/ospite/stato` (modulo accesso) e `GET/PUT /api/admin/regalo`
   (modulo admin, `requireAdmin`).

4. **Il client, senza cambiare nessuna schermata.** `src/lib/ospite/flag.ts`
   (l'interruttore, di fabbrica SPENTO), `src/lib/ospite/braccialetto.ts`
   (32 byte casuali nel portachiavi via `chiave.ts`, conto "braccialetto";
   IndexedDB sul web), `apiFetch` manda `x-jm-braccialetto` e distingue il
   402 `regalo_finito` (evento `jm:regalo-finito`, niente muro premium) dal
   402 "Premium required" (muro premium come oggi); `can()`/`useCan()`
   accendono voce e riassunto in locale SOLO con l'interruttore acceso;
   AuthGate al primo avvio, con l'interruttore acceso, sceglie il locale e fa
   nascere il braccialetto invece di rimbalzare al login. Con l'interruttore
   spento tutto e identico a prima (ultimo controllo di verify-ospite).

5. **I banchi.** `scripts/verify-ospite.mjs` (46 controlli) con due finti
   LATO SERVER (`scripts/lib/finti-server.mjs`): un Supabase finto che parla
   PostgREST e ha le tre funzioni SQL con la stessa logica, e un OpenAI finto
   che risponde a ogni schema JSON con un campo usage. Il dev server li
   raggiunge con due env nuove, `JM_SUPABASE_URL_SERVER` (entitlement.ts) e
   `OPENAI_BASE_URL` (server/openai.ts): in produzione non esistono.
   `scripts/lib/promessa-ospite.mjs` e la promessa del par. 5 in tre regole;
   `verify-pr10` e `verify-benvenuto` la misurano al posto di "zero richieste
   esterne" (riscritti, non cancellati).

6. **I documenti.** CLAUDE.md di accesso, admin, oggi, ricorda;
   ARCHITETTURA.md (lo scheletro dell'ospite); SPEC R1-R4 con "CODICE FATTO:
   solo la parte server/client invisibile; schermate in attesa del mockup",
   par. 5 (banco riscritto) e un par. 6-ter col COME dell'ospite.

## 2. I numeri dei banchi (tutti sul branch, dev server con i finti)

| Banco | Esito | Note |
|---|---|---|
| `npx tsc --noEmit` | pulito | |
| `npx eslint .` | pulito, zero warning | il lint dei confini compreso |
| `verify-i18n` | 7/7 | nessuna frase nuova a schermo (niente schermate) |
| `verify-ospite` | 46/46, due volte di fila | ~4 minuti: aspetta le cache del server (30 s e 60 s) |
| `verify-pr10` | 26/26 | promessa nuova; la parte telefono era gia rossa su main (vedi par. 4) |
| `verify-benvenuto` | 69/69 | promessa nuova nei tre punti |
| `verify-cassaforte` | 46/46 | regressione: la cassaforte non cambia |
| `verify-rete-spenta` | 14/14 | regressione: R11 non cambia |
| `verify-fix-20260820` | 53/53 | regressione |
| migration 023 su Postgres 16 locale | due volte, senza errori | piu la prova funzionale delle funzioni |

**Morsi** (rimesso il difetto, visto il rosso, ripristinato):
- `ospite.ts`, `p_blocca_nuove: false` al posto del tetto: verify-ospite
  42/46, rossi i quattro controlli di R4 (ospite nuovo sopra il tetto riceve
  AI, nessun `regalo_finito`, OpenAI chiamato, regalo spento ignorato).
- `api.ts`, intestazione del braccialetto tolta: rossi "giornata chiusa dal
  modello", "braccialetto registrato", "una riga in braccialetto_giornate",
  "ai_usage col braccialetto", "/api/ospite/stato usate 1" (il banco si e
  fermato li: l'ospite riceveva 401).
- `prewarm.ts` + `today-client.tsx`, warm-up acceso anche in locale senza
  braccialetto: verify-pr10 22/26, rossi "la promessa sulla rete regge" su
  desktop e telefono con la diagnosi giusta ("chiamata senza braccialetto:
  GET /api/transcribe-fallback").
- Durante la costruzione il banco ha trovato da solo un difetto vero, poi
  corretto (par. 3, punto 7).

## 3. Cosa ho scelto da sola, e perche

1. **Valori di fabbrica: 10 giornate, 100 euro al mese, regalo acceso**
   (come chiesto). Sono in `regalo` E in `REGALO_DI_FABBRICA`
   (src/lib/regalo.ts, il ripiego se il database non risponde). Si cambiano
   da `/api/admin/regalo` senza deploy; la schermata del pannello e da fare.
2. **Il tetto e in euro, la spesa in dollari:** i listini di `ai-usage.ts`
   sono in USD. Ho messo un cambio fisso `cambio_usd_eur` = 0,92 nella
   tabella `regalo`, cambiabile dal pannello. Non ho cercato un cambio vivo:
   una chiamata a un servizio di cambi per decidere se regalare due
   centesimi sarebbe stata sproporzionata.
3. **Cosa conta come "una giornata": un giorno di calendario (Europe/Rome)
   in cui l'AI ha lavorato per quel braccialetto** (decisione C del mockup,
   opzione 1). Rilavorare lo stesso giorno (trascrizione + riassunto + fatti +
   chiarimenti, o riaprire e correggere) costa una giornata sola. Il client
   puo dire il giorno con `x-jm-giorno`; oggi nessuna chiamata lo manda,
   quindi vale il giorno della chiamata. Conseguenza onesta: chi alle 00:30
   racconta "ieri" consuma la giornata di oggi. Se preferisci l'opzione 2
   (ogni chiamata costa) e un cambio di dieci righe nella funzione SQL.
4. **Il warm-up della trascrizione non spende** (`consuma: false`) e in
   modalita locale resta spento (prewarm.ts, com'era): aprire l'app non deve
   costare niente al regalo, e non chiama nessuna route.
5. **La grazia del tetto (R4)** vale anche per il regalo SPENTO dal pannello:
   chi ha gia la riga di oggi finisce la giornata, chi non l'ha no. Mi
   sembrava la lettura coerente di "chi sta gia scrivendo non viene
   interrotto a meta".
6. **iPhone e iPad della stessa persona condividono il braccialetto**
   (portachiavi sincronizzato: decisione E, opzione 1). E la stessa scelta
   che rende impossibile "reinstallo e ricomincio". Sul web IndexedDB muore
   con i dati del sito: accettato e scritto nel codice.
7. **"Salva e basta" (Cmd+S) non chiede piu i chiarimenti.** Il banco ha
   scoperto che il salvataggio senza AI chiamava comunque `/api/chiarimenti`
   quando `canAI` era vero: il codice prometteva "zero chiamate AI" e ne
   faceva una. Per l'ospite sarebbe stata una giornata del regalo spesa senza
   averlo chiesto e testo uscito dal dispositivo senza motivo. Correzione di
   una condizione in `today-client.tsx` (`canAI && opts.withAI`). E fuori dal
   perimetro della tabella del par. 8 (modulo oggi, che li e citato solo per
   le foto): l'ho fatto perche senza, la promessa del par. 5 e falsa; te lo
   segnalo apposta.
8. **Un account gratis SENZA braccialetto** (utente web vecchio) riceve 402
   "Premium required" come oggi. Il referto proponeva di regalargli un
   braccialetto alla prima chiamata: non l'ho fatto, perche un account gratis
   e il gradino 2 e la SPEC dice che ha l'AI "come sopra" (a quota): la
   strada giusta e che il client gli crei il braccialetto, e questo tocca il
   login, che e una schermata. Da decidere con le schermate.
9. **Chi crea braccialetti a raffica.** Il server accetta qualunque segreto
   ben formato e ne crea una riga: chi scrive uno script puo farsi mille
   braccialetti e mille regali. Non c'e modo onesto di legare un segreto a un
   telefono vero senza App Attest di Apple (fuori portata stanotte). La rete
   di sicurezza e il tetto mensile di R4, che e proprio a questo che serve.
   Segnalato, non risolto.
10. **Due env nuove per i banchi** (`JM_SUPABASE_URL_SERVER`,
    `OPENAI_BASE_URL`): in produzione non esistono e vincono gli indirizzi
    veri. Servono a puntare il SERVER ai finti sulla stessa macchina.
    Alternativa scartata: intercettare la rete del processo Node.
11. **La riga di `ai_usage` di un ospite ha `user_id` null.** `/api/usage`
    (i consumi in Impostazioni) filtra per `user_id` e non cambia; quando
    l'ospite diventa account il braccialetto viene legato all'utente ma le
    righe vecchie restano senza `user_id`: i suoi consumi da ospite non
    compaiono nei "suoi" consumi. Accettabile per il regalo, scritto qui.

## 4. Cosa ho trovato per strada e NON ho toccato

- **`verify-pr10`, parte telefono, era gia rossa su main:** cercava
  `[aria-label="Registra di nuovo"]` nell'intestazione di Oggi, che dal 1
  settembre (commit a5b6a6f, testate sul metro di Month) e solo desktop
  (`jm-solo-desktop`); il banco era stato toccato l'ultima volta il 31 agosto. L'ho riscritta sul
  mic del dock (in locale apre la scrittura, nessun muro). Non e un difetto
  dell'app, e un banco rimasto indietro.
- **`verify-consumi` e rosso su main da quando esiste la cassaforte:** il
  suo Supabase finto risponde `[]` a tutto, quindi `cassaforte_utente` e
  vuota e il cancello delle otto parole copre le Impostazioni ("cloud
  desktop: la riga c'e, una sola" non trova la riga). Non l'ho toccato:
  e del modulo impostazioni e non c'entra con l'ospite. Va aggiornato con un
  seme e una prova finti, come fa `verify-cassaforte`.
- **`verify-consumi` e `verify-benvenuto` hanno la porta 3200 scritta
  dentro.** A verify-benvenuto e verify-pr10 ho aggiunto `JM_BASE` come negli
  altri banchi (per farli girare tutti sullo stesso dev server); a
  verify-consumi no, per non toccarlo.
- `AiRoute` ha ancora `"extract-people"`, una route che non esiste (gia nel
  referto della mappa). Lasciato.
- `ARCHITETTURA.md` cita `scripts/verify-confini.mjs`, che non esiste (gia
  nella SPEC par. 10). Lasciato.

## 5. Cosa resta (dopo il tuo ok sul mockup)

Tutto cio che si vede, nell'ordine del mockup:

1. **Portare `OSPITE_DI_FABBRICA` a true** (src/lib/ospite/flag.ts): e il
   gesto che accende l'ospite per tutti. Prima, le schermate qui sotto.
2. **Il muro della quota** (mockup 03): un componente nel modulo
   abbonamento che ascolta `jm:regalo-finito`; su iPhone "Continua senza AI"
   e "Ho gia un account", sul web anche "prova premium". Oggi a regalo finito
   la giornata si salva col titolo di ripiego "Giornata raccontata": con il
   muro, il ripiego dovrebbe usare la prima riga come titolo (come "salva e
   basta").
3. **L'avviso discreto** (mockup 02) sotto la giornata chiusa quando
   `rimaste <= 3`, leggendo `/api/ospite/stato`.
4. **La riga in Impostazioni** (mockup 04): "AI in regalo" con usate/rimaste,
   "Dove sono le mie giornate" come voce (il bivio di /benvenuto), il pallino
   che dice "questo telefono" e non "Locale" (`account-menu.tsx`,
   `settings-client.tsx`).
5. **La voce "Regalo AI" in /admin** (mockup 05) sopra `/api/admin/regalo`,
   al posto del segnaposto "Piani e limiti".
6. **L'ospite che mette la email:** il login manda gia il braccialetto con
   la prima chiamata AI (apiFetch), e il server lo lega. Da provare
   end-to-end con la schermata, e decidere il punto 8 del par. 3.
7. **La migration 023 in produzione** (`supabase/DA-ESEGUIRE-ospite.sql`,
   la esegui tu nel SQL Editor) PRIMA del merge: con la tabella `regalo`
   assente il server usa i valori di fabbrica, ma senza `braccialetti` ogni
   chiamata dell'ospite risponde 500 "Cannot read braccialetti".
8. **L'etichetta privacy dell'App Store e la pagina della privacy** (SPEC
   par. 5): il testo dell'ospite passa dal server nel momento in cui l'AI
   lavora. Va detto.
9. **Il pezzo 4 (R5, l'email dopo N giornate)**, con il suo mockup.

## 6. Come si riproduce il banco

Nel sandbox, dal clone:

    JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199 \
    SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto \
    ./node_modules/.bin/next dev -p 3100        (con .env.local: NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co, NEXT_PUBLIC_SUPABASE_ANON_KEY=finto-anon-key)
    node scripts/verify-ospite.mjs

La migration, su un Postgres locale con `auth.users` e `auth.uid()` finti:
due volte `psql -f supabase/migrations/023_ospite.sql`, nessun errore.

## 7. La domanda per te (una sola)

Il mockup e in `design/mockups/ospite-primo-avvio.html`, e in fondo ha la
tabella delle decisioni A-G con le opzioni numerate. Cosa faccio adesso?

1. **Approvi il mockup cosi com'e** (e le proposte A2 B2 C1 D2 E1 F1 G2):
   apro il branch delle schermate e costruisco i cinque pezzi del par. 5,
   nell'ordine scritto; tu nel frattempo esegui `DA-ESEGUIRE-ospite.sql`.
2. **Approvi il mockup con modifiche**: scrivimi le lettere e i numeri
   diversi (per esempio "A1 B3, e il muro senza la frase sull'abbonamento")
   e correggo prima il mockup, poi parto.
3. **Vuoi prima unire in main la parte invisibile** (branch `ospite-server`,
   interruttore spento: nessuno vede niente) e discutere le schermate dopo:
   apro la PR e la unisco, dopo che hai eseguito la migration.
4. **Vuoi rivedere qualcosa del COME** (par. 3 di questo referto) prima di
   qualunque altra cosa: dimmi il numero del punto.
