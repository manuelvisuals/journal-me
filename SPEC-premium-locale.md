# SPEC premium locale — il diario resta sul telefono, l'AI funziona

Scritta il 1 settembre 2026. Stato: BOZZA, in attesa dell'ok di Manuel.
Nasce dal tema "le amiche hanno paura che Manuel legga le loro giornate",
dopo tre controaudit interni e una valutazione esterna indipendente che ha
APPROVATO questa strada (strada C del brief) chiedendo le correzioni che
questa SPEC incorpora. Nessuna riga di codice si scrive prima dell'ok.

Chi implementa: e lavoro di scheletro (store, plan, capabilities, AuthGate)
piu ritocchi nei moduli accesso, abbonamento e impostazioni. Va fatto in una
sessione scheletro dichiarata, su branch, come da WORKERS.md e AGENTS.md.

---

## 1. Il problema e il modello di minaccia

Oggi le due modalita si escludono: LOCALE = niente account, niente rete,
niente AI; CLOUD = account, diario su Supabase IN CHIARO, AI. Chi vuole
l'AI e costretto a consegnare il diario al database, dove l'amministratore
puo leggerlo. E la paura delle utenti nuove, ed e fondata.

Minaccia coperta da questa SPEC (formulazione del valutatore esterno):
accesso amministrativo ORDINARIO ai dati archiviati — dashboard, database,
backup, strumenti operativi. Dopo questa SPEC, nell'uso ordinario non
esiste piu materialmente un database di diari da aprire per le utenti in
premium locale.

Minaccia NON coperta, da dichiarare e non nascondere: uno sviluppatore che
modifichi intenzionalmente app o backend per copiare cio che transita
verso l'AI. Nessuna architettura la elimina finche app, aggiornamenti e
backend sono controllati dalla stessa persona. Si dichiara nei testi (§6).

## 2. La decisione

Si separano due assi che oggi il codice tiene incollati:

- ARCHIVIO: dove vive il diario. `locale` (IndexedDB sul dispositivo) o
  `cloud` (Supabase). Non cambia niente di esistente.
- ACCOUNT: c'e una sessione Supabase oppure no. Serve solo a sapere CHI E
  e SE HA IL PREMIUM.

La matrice degli stati:

| Archivio | Account  | Nome                | Rete ammessa                        |
|----------|----------|---------------------|-------------------------------------|
| locale   | no       | locale gratis       | ZERO richieste (promessa invariata) |
| locale   | si       | PREMIUM LOCALE (nuovo) | solo auth Supabase + route /api/* su azione dell'utente |
| cloud    | si       | cloud (invariato)   | come oggi                           |

Nel premium locale il diario resta in IndexedDB e NON viene mai caricato:
le route AI ricevono il testo nel body al momento della richiesta (fatto
verificato: process-entry, split-by-date, chiarimenti, extract-facts,
transcribe-fallback, classify, recap/generate leggono tutte dal body, mai
dal database). Nel database di Manuel, per un'utente premium locale, ci
sono: email, profilo (plan), consumi AI aggregati (ai_usage: token, mai
testo). Zero righe di diario.

Il backup resta quello esistente (export file v1 + share sheet + banner
14 giorni). Il backup cifrato automatico (strada B del brief) NON si
costruisce ora: capitolo futuro solo se il backup manuale si rivelera
scomodo nell'uso reale. Idem la cifratura E2E del cloud (strada A).

## 3. Il flusso per l'utente (il percorso dell'amica)

1. Scarica l'app (TestFlight per la beta), sceglie "Tienilo solo su questo
   dispositivo": locale gratis, come oggi. Zero rete, zero account.
2. Tocca il mic o "vedi" su un nudge: si apre il muro premium (esiste).
   Il muro, in locale, porta al login (esiste). NOVITA: dopo il login la
   modalita NON cambia — il diario resta sul telefono. Niente piu vicolo
   cieco ne migrazione implicita al cloud.
3. Prima del PRIMO uso AI: schermata di consenso esplicito (§6.3). Senza
   consenso, niente chiamate AI; il resto dell'app funziona.
4. Manuel la promuove premium a mano dal database (profiles.plan, come gia
   fatto per madh52; Stripe resta rimandato, decisione gia presa).
5. Da qui: registra, l'AI riassume, tutto si salva in IndexedDB.

Casi limite (le quattro richieste del valutatore, con decisione):

- **Il diario appartiene al DISPOSITIVO, con un proprietario.** Un solo
  database IndexedDB (`journalme`), come oggi. Al primo login in premium
  locale si scrive in `meta` lo user_id: da quel momento il diario ha un
  proprietario. Se sullo stesso telefono entra un ACCOUNT DIVERSO, il
  diario non si mostra e non si tocca: schermata onesta "Questo
  dispositivo contiene il diario di un altro account" con due sole uscite,
  esci dall'account oppure torna al proprietario. Niente cancellazioni
  automatiche, niente secondo diario nascosto: caso raro, gestito in modo
  sicuro e spiegato, non in modo furbo.
- **Il diario locale non si cancella MAI da solo.** Ne al logout (che
  toglie sessione e cache piano, non i dati), ne alla scadenza del
  premium (l'AI risponde 402 e apre il muro; scrivere, rileggere,
  esportare funzionano per sempre), ne alla cancellazione dell'account
  (la route delete-account esistente cancella il lato server; il locale
  resta finche l'utente non usa "cancella tutto", che esiste gia con la
  conferma a due passi). L'unico modo di perdere il diario e volerlo.
- **Telefono nuovo:** account premium presente, diario vuoto. Schermata
  dedicata che lo DICE invece di mostrare un'app misteriosamente vuota:
  "Il tuo diario vive sul dispositivo. Su questo telefono e vuoto. Se hai
  un backup, importalo da qui" (l'import esiste). Nessuna promessa sul
  ripristino iCloud del telefono finche il test §8.4 non e stato fatto.
- **Migrazione cloud -> locale per utenti esistenti** (oggi: Manuel):
  FASE 2, fuori da questa SPEC. Va fatta esplicita e col passo finale di
  cancellazione delle copie in chiaro dal cloud. Le amiche sono utenti
  nuove e non la aspettano.

## 4. Cambiamenti al codice, file per file

Scheletro:

- `src/lib/data/store/index.ts` — il flag `jm.mode === "local"` continua a
  decidere l'ARCHIVIO, sincrono e per primo (la promessa zero-rete del
  ramo gratis non si sposta). Nuovo flag `jm.account === "1"`, scritto al
  login riuscito partendo dalla modalita locale: SOLO con quel flag il
  ramo locale costruisce il client Supabase (import dinamico, auth
  soltanto). Senza flag, oggi come ieri, il client non nasce. La modalita
  risolta guadagna l'informazione account (es. `{ archivio, account }` o
  un quarto valore; scelta fine al momento dell'implementazione, ma i
  call-site di `useStorageMode()` non devono cambiare firma).
- `src/lib/plan.ts` — `refreshPlan()` oggi esce se `mode !== "cloud"`:
  deve girare anche in premium locale (locale + account). `clearPlanCache`
  al logout resta.
- `src/lib/capabilities.ts` — oggi `can()` e' `mode === "cloud" && premium`.
  Diventa: `voice/aiSummary/recap/patterns` = account presente + premium
  + consenso AI dato (§6.3), qualunque sia l'archivio; `sync` = SOLO
  archivio cloud (il premium locale non sincronizza niente, e il testo
  della UI non deve promettere il contrario).
- `src/components/auth-gate.tsx` — il ramo locale resta "entrato"; con
  `jm.account` monta anche il listener di sessione (per il refresh token
  e per la schermata proprietario §3). `/login` resta raggiungibile in
  locale come oggi.
- `src/lib/api.ts` — invariato: `getAccessToken()` trova il token perche
  in premium locale il client auth esiste. Verificare che in locale
  GRATIS nessun percorso lo importi in modo da costruire il client.

Moduli (ognuno nel suo recinto, prefissi CSS e cataloghi i18n del modulo):

- `accesso` — al login riuscito partendo da archivio locale: scrivere
  `jm.account`, NON toccare `jm.mode`, e portare alla schermata di
  benvenuto premium con la frase giusta ("il tuo diario resta su questo
  telefono"). La strada per la migrazione al cloud NON parte da qui
  (fase 2).
- `abbonamento` — il muro premium in locale gia porta al login: aggiornare
  i testi (niente "passa al cloud"); la premium-welcome distingue
  archivio locale da cloud.
- `impostazioni` — pannello "Dove sono le mie giornate" riscritto (§6.1);
  riga consenso AI con revoca (§6.3); la riga della cancellazione account
  dichiara cosa resta sul telefono.
- Migration `020_ai_consent.sql` — `profiles.ai_consent_at timestamptz`
  (nullable). Il consenso si registra lato server al primo si; la revoca
  lo azzera. Serve come prova del consenso (GDPR), non come gate runtime:
  il gate runtime e client + 402.

Fuori perimetro, dichiarato: nessun cambio alle route AI, allo store
cloud, ai temi, al sito. Nessun nuovo endpoint.

## 5. Cosa NON si costruisce ora (deciso, non dimenticato)

- Backup automatico cifrato su Supabase (strada B) e cifratura E2E del
  cloud (strada A): rimandate, motivazioni nel brief di valutazione.
- Migrazione cloud -> locale (fase 2).
- Stripe/IAP: il pagamento vero resta rimandato (decisione di Manuel del
  19 agosto); per la beta il premium si assegna a mano.
- Zero Data Retention OpenAI: pratica da avviare PRIMA DEL PUBBLICO, non
  blocca la beta. Nota verificata: tutte le chiamate usano
  /v1/chat/completions e /v1/audio/transcriptions, nessuna /v1/responses,
  nessun parametro store — di default OpenAI non archivia per riuso, ma i
  log anti-abuso possono tenere prompt/output fino a 30 giorni: e il buco
  che ZDR chiude.

## 6. I testi (italiano qui; inglese nei cataloghi dei moduli)

Regola del valutatore, vincolante: MAI frasi assolute ("il diario non
lascia mai il telefono" e FALSA durante una chiamata AI). La promessa
canonica, da usare ovunque serva una frase sola:

> Le tue giornate sono salvate sul tuo dispositivo, non nei nostri server.
> Quando usi una funzione AI, solo il testo necessario a quella richiesta
> viene inviato in modo protetto per l'elaborazione.

### 6.1 Pannello "Dove sono le mie giornate" (impostazioni), premium locale

- Il tuo diario e su questo telefono. Non e archiviato nei nostri server.
- Nei nostri server ci sono: la tua email, il tuo abbonamento e il
  conteggio dei consumi AI (numeri, mai testo).
- Quando chiedi un riassunto o un recap, il testo di quella richiesta
  viaggia cifrato fino ai nostri server e a OpenAI, serve a generare il
  risultato e non viene salvato da noi. OpenAI non lo usa per addestrare
  i suoi modelli e puo conservarlo nei controlli anti-abuso fino a 30
  giorni.
- Un limite che ti diciamo chiaramente: chi sviluppa l'app potrebbe, in
  futuro, cambiarla. Le protezioni descritte valgono per l'app cosi come
  e oggi. Non possiamo promettere l'impossibile: possiamo promettere che
  non abbiamo un archivio delle tue giornate da nessuna parte.
- Il backup lo fai tu, quando vuoi, e va dove scegli tu (per esempio il
  tuo iCloud Drive). Noi non lo vediamo.

### 6.2 Schermata "prove che puoi fare tu stessa" (stesso pannello, in fondo)

Etichetta esatta: "verifiche che puoi fare tu stessa" (non "prove"):
modalita aereo (l'app funziona senza rete, tranne l'AI), App Privacy
Report di iOS (quali server l'app ha contattato), etichetta privacy
sull'App Store. Con la nota onesta che mostrano i collegamenti, non il
contenuto.

### 6.3 Consenso AI (schermata al primo uso, revocabile da impostazioni)

Titolo: "Prima che l'AI legga qualcosa". Corpo: la promessa canonica, piu
l'elenco di COSA parte (il testo o l'audio di quella richiesta), VERSO CHI
(server Dayalogue, poi OpenAI), PER QUANTO (elaborazione; anti-abuso
OpenAI fino a 30 giorni), e il fatto che il diario locale resta fuori.
Due bottoni: "accetto e continuo" / "non ora" (uscita gratuita, come il
muro premium: si torna alla scrittura). La revoca da impostazioni spegne
le capability AI senza toccare nient'altro. Il si scrive
`profiles.ai_consent_at`.

## 7. Le due tappe (dal verdetto esterno)

PRIMA DELLA BETA (amiche, TestFlight): questa SPEC implementata e
verificata; testi §6; consenso AI; premium a mano.

PRIMA DEL LANCIO PUBBLICO (fuori da questa SPEC, elenco per non perderlo):
DPIA e registro trattamenti; privacy policy art. 13 coerente; DPA OpenAI
(e chiarimento sul punto "sensitive data unexpected" del loro DPA, che per
un diario con aree Corpo/Emozioni non e onesto lasciare implicito); ZDR;
verifica che Vercel/logging non registrino i body; test ripristino iCloud
(§8.4); etichetta privacy App Store scritta con prudenza (finche la
retention OpenAI non e risolta, NON dichiarare "User Content not
collected"); IAP per vendere dentro l'app iOS; cancellazione account
dall'app (la route esiste gia: verificare il percorso completo).

## 8. Verifica (banchi, prima di dichiarare fatto)

1. `verify-premium-locale.mjs` (nuovo, Playwright): (a) locale GRATIS:
   zero richieste esterne, invariato e ancora verde; (b) premium locale:
   le uniche richieste di rete sono auth Supabase e /api/* su azione
   esplicita — scrivere e rileggere una giornata NON genera richieste;
   (c) login secondo account -> schermata proprietario, diario intatto;
   (d) logout -> diario intatto, sessione e jm.plan puliti; (e) 402 ->
   muro, giornata comunque salvata in locale col testo grezzo;
   (f) consenso: prima del si nessuna chiamata AI parte, dopo la revoca
   nemmeno.
2. Banchi esistenti rieseguiti senza regressioni (in particolare quelli
   che asseriscono zero-rete in locale: vanno aggiornati a "zero rete in
   locale GRATIS", ed e un cambio di promessa da fare a occhi aperti).
3. tsc + eslint puliti; verify-i18n verde coi cataloghi nuovi.
4. Su device vero, prima del pubblico: iPhone A con diario -> iCloud
   Backup -> ripristino su iPhone B -> il diario c'e? Qualunque esito, la
   schermata "telefono nuovo" (§3) resta: il ripristino iCloud non si
   promette finche non si e visto funzionare.

## 9. Domande aperte per Manuel (da sciogliere prima o durante)

1. Il nome commerciale della cosa: nelle impostazioni oggi c'e "Locale" e
   "Cloud". Il premium locale come si chiama a schermo? (proposta:
   "Sul tuo dispositivo", con targhetta Premium quando attivo).
2. Per la beta le amiche entrano da TestFlight: ok a tenerle su build
   TestFlight finche non si decide IAP, giusto?
3. La schermata di consenso AI va mostrata anche agli utenti CLOUD
   esistenti al primo uso dopo l'aggiornamento (coerenza GDPR)? Proposta:
   si, stessa schermata, stesso flag.
