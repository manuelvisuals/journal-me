# Handover · Journal.me

Documento di riferimento per chi (Claude o umano) riprende lo sviluppo.
Aggiornato al **26 luglio 2026**, allineato al commit `c1b8d30` di `main`.

Regola numero uno: **la fonte di verita del codice e il repo GitHub, non questo file.**
Se qui leggi qualcosa che il codice smentisce, vince il codice — e poi correggi qui.

---

## 1. Cos'e Journal.me

Web app mobile-first di journaling personale (utente unico: Manuel, italiano, iPhone
come device primario, installabile come PWA).

Il ciclo: a fine giornata apri l'app, parli a voce libero in italiano; l'app trascrive
1:1 (il testo e la sorgente di verita, l'audio si butta); un modello genera headline
"tipo notizia di borsa" + snippet + sintesi per macro-aree (Lavoro / Relazioni / Corpo /
Emozioni). Sopra ci stanno: vista Mese densa riga-per-giorno, Recap letterari
mensili/semestrali/annuali, e Remember (persone, todo, note, luoghi, idee) alimentato
sia a mano sia in automatico dal racconto serale.

Sezione futura gia in discussione: Palestra (set/peso/macchinari, AI come personal trainer).

---

## 2. Dove si lavora (organizzazione cartelle, luglio 2026)

**Tutto vive nel repo.** Si lavora su un clone fresco di `main`
(https://github.com/manuelvisuals/journal-me), si committa, si pusha: auto-deploy su
Vercel. Non esistono copie di lavoro sul Mac di Manuel — niente mirror locali, niente doc
sul Desktop. Se un file conta, sta nel repo; se non sta nel repo, non esiste.

Motivo: in passato il progetto viveva in tre posti (mirror in `~/Documents`, clone in
`/tmp`, GitHub) e le copie andavano fuori sync, generando handover sbagliati.

Documenti versionati nella root e in `design/`:

```
HANDOVER.md                  questo file, unica fonte di contesto
HANDOVER-recording-bug.md    referto del bug mic iOS (utile finche e aperto, vedi §8)
AUDIT-tre-esperti.md         audit di giugno, stato aggiornato in §9
design/brandbook.html        fonte di verita del look
design/mockups/              mockup approvati
```

**Quando aggiorni questo file, committalo.** E l'unico posto dove vive.

---

## 3. Stack e ambienti

```
Next.js 16.2.6 (App Router, TS, Tailwind v4) + Turbopack
React 19.2.4
@supabase/supabase-js ^2.106 + @supabase/ssr ^0.10
Font: Inter (UI) + Spectral (prosa) via next/font

GitHub:   github.com/manuelvisuals/journal-me
Vercel:   journal-me-chi.vercel.app          (auto-deploy on push to main)
Supabase: fljshsmpmpzapcczsbwc.supabase.co   (nuovo, 12 ago 2026, eu-north-1)
          il vecchio ref sxpijppbedgucdmiitkr e abbandonato: vedi 8C
```

Env vars che il codice legge (tutte su Vercel; `.env.local` per il dev locale):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (solo server: trascrizione, process-entry, recap, classify)
- `DEMO_USER_EMAIL` (opzionale, default `demo@journal.me`)
- `DEMO_USER_PASSWORD` (obbligatoria perche il tour demo funzioni)

Nota: `.env.example` elenca solo le tre Supabase. Le altre tre sono documentate qui.

---

## 4. Regole operative (non negoziabili)

Duplicate in memoria persistente (`workflow_manuel.md`). Sintesi:

1. **Git author email `spamming.madh52@gmail.com`**, mai `madh52@gmail.com`.
2. **Mai chiedere a Manuel di aprire il terminale.** Se serve, riformula come SQL da
   incollare nel Supabase SQL Editor, o eseguilo tu nel sandbox.
3. **`npx tsc --noEmit` + eslint clean prima di ogni push.** Nessuna eccezione.
4. **Cambio visivo non triviale = mockup HTML prima**, in `design/mockups/`, condiviso
   come link `computer://`, OK esplicito, poi codice. Non vale per bugfix o cambi testo.
5. **Nessun push prima dell'OK** sul piano o sul mockup.
6. **Verifica in Chrome sul deploy live** prima di dire "fatto".
7. **Nessuna emoji** in codice, config, commit, markdown.
8. **Numeri in italiano** via `LOCALE = "it-IT"` in `src/lib/format.ts`. Mai
   `toLocaleString(undefined, ...)` sparso.
9. **Niente paternalismo sulle API key** durante l'MVP. (Ma le key non finiscono mai in
   memoria persistente ne nel codice committato.)
10. **Una domanda per volta**, e se ci sono opzioni presentale numerate.
11. **Push-back, non yes-man.**

Divisione del lavoro: Claude fa codice, file, tsc/eslint, scrittura delle migration,
verifica Chrome. Manuel esegue le SQL su Supabase, apre i link `computer://`, gestisce le
connessioni account (Vercel/GitHub/Supabase), manda screenshot.

**Push: ogni chat scrive per se.** Non esiste piu nessuna "chat sorella" che committa al
posto tuo: quel giro e morto. Manuel ti passa un PAT (classic, scope `repo`, scadenza
corta) e tu committi e pushi dal tuo sandbox. Setup:

```bash
printf 'https://manuelvisuals:<PAT>@github.com\n' > /tmp/.gc && chmod 600 /tmp/.gc
cd /tmp/jm-work && git config credential.helper "store --file=/tmp/.gc"
git config user.email "spamming.madh52@gmail.com"
git config user.name "Manuel (via Claude)"
```

Prima di pushare: `git push --dry-run origin main` per confermare che il token e quello
giusto (Manuel ne ha di altri progetti). `git add` con i file espliciti, mai `git add -A`.
Il PAT non va mai in memoria persistente ne in un file committato.

---

## 5. Identita visiva

> **Fonte di verita: `design/brandbook.html`** (19 capitoli, dai principi all'export dei
> token, pensato per ricostruire tutta la UI da zero se sparisse il CSS). Prima di
> qualsiasi cambio visivo: leggi il brandbook, leggi il mockup relativo, poi proponi un
> mockup nuovo. In caso di conflitto con qualsiasi riassunto, vince il brandbook.

Tema "wine premium". Token in `src/app/globals.css`:

```
--color-bg            #050304    page outer
--color-bg-phone      #0E0709    app body
--color-surface       #1D1013    card, input
--color-surface-2     #241418
--color-line          rgba(255,229,214,.075)
--color-accent        #E3A15F    ambra, solo accento
--color-accent-pressed #D08F4D
--color-accent-hi     #F0B875
--color-ink           #F4E7DE    testo primario, cremoso (mai bianco puro)
--color-ink-muted     #CDB7AE
--color-ink-faint     #8E7770
--color-success       #A8C9B0
--color-danger        #F87171
```

Inter per UI e numeri, Spectral per la prosa editoriale (recap, dropcap, titoli
editoriali). Body con radial-gradient caldo in alto a sinistra + grana SVG ~2.8%
(`body::before` / `body::after`). Tap feedback globale: `scale(0.97)` a 80ms.
Label in maiuscoletto con tracking positivo; headline con tracking negativo.

Mockup in `design/mockups/`: `login`, `today`, `mese`, `recap`, `remember`, `settings`,
`altro`, `metrics-editable`, `recording-flow-v2`, `recording-overlay-v3`,
`notte-feedback-persone`, `idee-feature`.

---

## 6. Stato reale del codice

`main` a `c1b8d30` (14 giugno 2026). L'MVP e completo e in produzione: tutte le sezioni
esistono, salvano su Supabase e sono state verificate in Chrome sul deploy live.

### Navigazione

Tab bar a 5 slot: **Oggi** (`/`) · **Mese** (`/mese`) · **mic centrale ambra** (apre la
registrazione via `/?record=1`) · **Ricorda** (`/remember`) · **Altro** (`/settings`).
Recap non e piu un tab: si raggiunge dalla card editoriale in cima ad Altro.

### Route

```
/                    Today (empty / recording / review / processing / people /
                     filled / manual / no-capture — macchina a stati in today-client)
/giorno/[date]       Dettaglio giorno, riusa FilledView con tutti i controlli
/mese                Feed infinito newest-first, sticky month header, jump picker
/recap               Segmented Mensili/Semestrali/Annuali + detail con dropcap
/remember            Filtri a chip, raggruppamento per fascia temporale, quick-capture
/settings            "Altro": card Recap, micro-goal CRUD, account, logout
/login               Magic link + bottone App Tour
/auth/callback       Scambio code -> sessione (PKCE)
```

### API (tutte server-side, la chiave OpenAI non tocca mai il browser)

```
/api/realtime/session      relay SDP per OpenAI Realtime (gpt-4o-transcribe)
/api/transcribe-fallback   trascrizione full-clip di riserva (gpt-4o-transcribe)
/api/process-entry         gpt-4o-mini -> headline, snippet, aree macro
/api/split-by-date         gpt-4o-mini -> smista un racconto multi-giorno
/api/extract-people        gpt-4o-mini -> persone citate nella giornata
/api/remember/classify     gpt-4o-mini -> riclassifica le note in persona/todo/luogo/idea
/api/recap/generate        gpt-4o (non mini, serve la prosa) -> recap letterario
/api/demo                  login sull'account condiviso demo@journal.me
```

### Livello dati

`src/lib/data/{entries,goals,recaps,remembers}.ts`. **Non esiste piu il ramo
localStorage**: anche la demo passa da Supabase (account condiviso `demo@journal.me`).
Il parametro `mode` sopravvive nelle firme solo per stabilita dei call-site ed e ignorato.

### Migration

```
001_init.sql             entries, goals, entry_goals, remembers, recaps + RLS + seed goal
002_user_settings.sql    user_settings.glossary (legacy, vedi sotto)
003_entry_goals_jsonb.sql entries.goals_on jsonb
004_remove_libro.sql     toglie 'libro' dal check di remembers.kind
005_entry_people.sql     entries.people jsonb
```

001, 002, 003, 005 risultano applicate. **004 e da confermare** (nell'ultimo giro
risultava ancora da eseguire da parte di Manuel nel SQL Editor). Prima di toccare
Remember, verifica.

### Pipeline di registrazione (riscritta il 12 agosto 2026)

**Non c'e piu il realtime.** L'audio non viene piu streammato a OpenAI mentre parli: si
registra in locale e si manda tutto insieme alla fine.

1. Prewarm: `GET /api/transcribe-fallback` al mount di Today e al tap sul mic, per non
   pagare il cold start di Vercel dopo aver premuto Fine.
2. `getUserMedia` fresco a ogni sessione, con retry se la traccia nasce non-`live`
   (fino a 4 tentativi, 300ms) e attesa dell'evento `unmute`. **Nessuna cache
   module-level dello stream.**
3. `MediaRecorder` armato ma in pausa. Chunk ogni secondo, cosi uno stop brusco non
   perde l'ultimo pezzo.
4. **Push-to-talk**: tieni premuto e il recorder fa `resume()`, lasci e fa `pause()`. I
   silenzi non entrano proprio nel file, quindi le voci di sfondo nei buchi non esistono
   per il modello.
5. Waveform reale (Web Audio `AnalyserNode`): piatta = non ti sente. E l'unico segnale
   onesto che hai mentre parli, perche non c'e piu testo che scorre.
6. Wake lock durante la registrazione, riacquisito al ritorno in foreground.
7. Stop -> il clip va a `/api/transcribe-fallback` (`gpt-4o-transcribe`, timeout 120s)
   -> schermata **review** (correggi i nomi propri) -> AI -> eventuale review persone ->
   giornata salvata.

**Perche.** Due motivi, in ordine di importanza. (a) *Qualita*: il realtime tagliava
l'audio su un VAD server-side a 250ms di silenzio, quindi una pausa mentre pensi poteva
mangiare una parola e il modello non vedeva mai piu di un frammento; il clip intero gli
da tutto il contesto, che e esattamente cio che serve per i nomi propri. (b)
*Affidabilita*: il bug del primo avvio iOS (traccia `ended`, sender WebRTC che spedisce
silenzio) viveva tutto nel percorso streaming. `MediaRecorder` legge la traccia
direttamente ed era gia in quel file come rete di sicurezza — la rete e diventata il
pavimento.

**Cosa si perde:** il testo che scorreva mentre parli. La schermata di review dove
correggi i nomi c'era gia e resta.

**Cosa resta in giro:** `/api/realtime/session` esiste ancora ed e ancora un relay SDP
funzionante, ma **nessuno lo chiama piu**. Non e stato cancellato per poter tornare
indietro senza riscrivere il server. Se dopo il 18 agosto si vuole rimettere il live
come anteprima sopra la registrazione nativa, si riparte da li.

Vocabolario della trascrizione: arriva da **Remember > Persone** (`remembers` con
`kind='persona'`), inviato col header `X-JM-Glossary`. Il vecchio Glossario e stato
eliminato; `user_settings.glossary` resta solo come fallback legacy lato server.

---

## 7. Trappole gia pagate (non ripeterle)

- **`src/proxy.ts`, non `middleware.ts`.** Next 16 ha rinominato il middleware.
- **`entries` non ha la colonna `duration_seconds`.** Metterla in un `select` fa fallire
  silenziosamente tutta la query (era il BUG2 di maggio: "Nessuna giornata" su giorni
  pieni). `entry.durationSeconds` e semplicemente 0.
- **"Oggi" si calcola solo via `APP_TZ = "Europe/Rome"`** e `nowAppParts()` in
  `format.ts`. Mai `new Date().getDate()` grezzo: server (UTC) e client divergono di un
  giorno intorno a mezzanotte.
- **React 19 lint `react-hooks/set-state-in-effect`**: per leggere localStorage usa
  `useSyncExternalStore`, non `useEffect` + `setState`.
- **`body > *` in globals.css** setta `position:relative; z-index:1` e batte per
  specificita le classi Tailwind: l'overlay full-screen ha bisogno di stili inline.
- **Micro-goal 100% da DB**: nessun hardcode di default. Zero goal = area dot vuota.
- **`staleTimes` in `next.config.ts`** tiene la router cache client (180s dynamic): dopo
  una mutazione chiama `router.refresh()` o vedi dati vecchi al cambio tab.
- **`next build` locale fallisce** col symlink di node_modules (Turbopack). Non insistere:
  fidati di tsc + eslint, il build vero lo fa Vercel.

---

## 8. Bug aperti e debito noto

**A. Registrazione muta al primo avvio (iOS)** — il percorso che sbagliava e stato
eliminato il 12 agosto (vedi §6): non si passa piu da WebRTC, e `MediaRecorder` era
gia la cosa che in quei casi registrava davvero. **Resta comunque da verificare su
device**: il retry di `getUserMedia` sulla traccia `ended` e ancora l'unica difesa, e
non e mai stato visto funzionare dal vivo. Storia originale sotto.
Al primissimo grant del permesso mic, `getUserMedia` a freddo torna una traccia con
`readyState: "ended"` (zero frame audio) mentre connessione e sessione OpenAI sono sane.
Mitigazione in `1a0ab82` (retry di acquisizione) piu la rete di sicurezza
`MediaRecorder` + fallback. **Manca la conferma su device dopo il repro.** Referto
completo in `HANDOVER-recording-bug.md`.
Regola collegata, imparata a caro prezzo: non dichiarare risolto un bug senza averlo
strumentato e visto risolversi.

**B. ~~Diagnostica ancora in produzione~~ CHIUSO il 12 agosto.** Il blocco "TEMPORARY
DIAGNOSTICS" e `startStatsPoll()` sono spariti con la riscrittura della registrazione
(non c'e piu una peer connection di cui leggere le stats). Resta solo un `dbg()`
console-only di poche righe.

**C. Backend Supabase fermo — l'app e giu (diagnosi 2026-07-26, da chiudere).**
Il progetto Supabase `sxpijppbedgucdmiitkr` e **in pausa, e vive su un account Supabase
diverso** da quello che Manuel usa di solito (`spamming.madh52@gmail.com` /
`manuelvisuals's Org`, dove ci sono solo `propertyscanner` e `stoqfolio`). I dati NON
sono persi: il progetto va solo riattivato dall'account giusto.

Sintomo osservato dal vivo: `POST /api/demo` **non risponde mai** (>45s, resta appesa) e
il bottone App tour resta su "APERTURA..." per sempre. Non e un 500 e non e la env var
mancante: se `DEMO_USER_PASSWORD` non ci fosse, la route risponderebbe 500 subito, al
primo `if`, senza toccare la rete. Si appende dentro `signInWithPassword`, cioe nella
chiamata verso un progetto Supabase che non risponde.

Non e solo il demo: con quel backend fermo **niente funziona**, magic link compreso. La
pagina di login carica veloce lo stesso e puo ingannare — senza cookie di sessione
`getUser()` nel middleware risponde senza toccare la rete, quindi `/login` e veloce anche
a database spento.

Quando si riprende: riattivare il progetto dall'account che lo possiede, verificare che le
env vars su Vercel puntino ancora a quel ref, e ricontrollare che l'utente
`demo@journal.me` + `DEMO_USER_PASSWORD` esistano.

**C-bis. L'app resta muta quando il backend e giu.** Difetto di prodotto emerso da questa
indagine: le chiamate server non hanno timeout e il client mostra "Demo non disponibile"
per qualsiasi fallimento — ma se la richiesta si appende non mostra nemmeno quello. Sono
passate settimane senza che l'app dicesse niente. Da fare: timeout sulle chiamate al
backend e messaggio d'errore vero al posto del silenzio.

**D. Migration 004** possibilmente non applicata (vedi §6).

**E. Scrittura manuale** e raggiungibile dallo stato vuoto e dal giorno pieno, ma il
percorso non e simmetrico ovunque: verificare prima di dare per scontato.

---

## 9. Backlog dall'audit "tre esperti" (giugno 2026)

L'audit (designer Apple-style, UX senior, esperto dettatura) e in
`AUDIT-tre-esperti.md`, nella root del repo. Stato aggiornato al codice attuale:

**Chiusi dopo l'audit**
- Waveform collegata all'audio reale (`14aec16`).
- Conflitto dei due rossi: stop/salva ora e ambra con spunta.
- `aria-live="polite"` sull'area trascrizione.
- `prefers-reduced-motion` introdotto (un blocco in `globals.css` — verificare che copra
  tutte le animazioni, non solo la waveform).
- Falso allarme silenzio a 8s rimosso (`f9608e2`).
- Tab in italiano: la label e "Ricorda".
- Push-to-talk: elimina il problema delle voci di sfondo nei silenzi.

**Ancora aperti**
- P0: backend Supabase in pausa, app giu (§8C — non era "demo rotto": e tutto il backend);
  bug mic primo avvio non verificato (§8A).
- P1: rimuovere logging e poll `getStats` dalla produzione (§8B); conferma o undo
  sull'annulla registrazione (oggi il cestino scarta tutto senza rete).
- P2: casing tipografico incoerente; glow troppo neon rispetto al linguaggio Apple
  attuale; spaziature a mano invece di un ritmo 8pt; icone "Oggi" (mirino) e "Altro"
  (tre puntini) ambigue; haptics ed earcon su start/stop; valutare light mode;
  `logprobs` richiesti e mai usati (si potrebbero evidenziare le parole a bassa
  confidenza); stati `:focus` scarsi.

---

## 10. Setup del sandbox

Il filesystem montato e troppo lento per `npm install`. Pattern che funziona:

```bash
git clone https://github.com/manuelvisuals/journal-me.git /tmp/jm-work
mkdir -p /tmp/jm-deps && cp /tmp/jm-work/package*.json /tmp/jm-deps/
cd /tmp/jm-deps && npm install --no-audit --no-fund
ln -sfn /tmp/jm-deps/node_modules /tmp/jm-work/node_modules
cd /tmp/jm-work && npx tsc --noEmit && npx eslint .
```

Il sandbox puo essere azzerato tra una conversazione e l'altra: ri-clona e reinstalla,
non c'e stato da preservare fuori da GitHub.

---

## 11. Come iniziare una sessione

1. Leggi questo file.
2. Leggi la memoria persistente (`MEMORY.md` e i file topic: progetto, brandbook, utente,
   workflow, bug registrazione, feedback verify-before-claiming-fixed).
3. Clona `main` e guarda `git log --oneline -15`: e la foto piu aggiornata che esista.
4. Chiedi a Manuel una cosa sola: da dove si riparte.
5. Mockup prima del codice se si tocca il visivo. Push solo dopo tsc + eslint + OK.

Buon lavoro.

---

## 12. Guscio iOS (agosto 2026) — l'app sul telefono

Obiettivo dichiarato da Manuel il 12 agosto 2026: entro il 18 agosto un'app vera
sull'iPhone, montata con Xcode (account developer Apple gia verificato), che faccia
cinque cose e basta — registrare bene, trascrivere e salvare la giornata, riassumerla
con l'AI, Face ID e notifica serale, e partire istantanea.

### La scelta di fondo

Capacitor 8, **senza `server.url`**. Il guscio non carica il sito da Vercel: l'intera
interfaccia (2 MB di export statico) vive dentro il binario e parte da file locali.
Dalla rete arrivano solo i dati Supabase e le chiamate AI. Puntare il guscio a
`journal-me-chi.vercel.app` sarebbe costato un giorno invece di una settimana, ma ogni
avvio sarebbe rimasto un caricamento di pagina — cioe esattamente il difetto da togliere.

CocoaPods non serve: il progetto e generato con Swift Package Manager
(`npx cap add ios --packagemanager SPM`), quindi Xcode risolve i plugin da solo.

### Due build da un solo codice

`next.config.ts` cambia forma in base a `JM_MOBILE`:

- `next build` -> il deploy Vercel di sempre. **E lui a servire `/api/*`**: la chiave
  OpenAI sta li e non entra mai nell'app.
- `JM_MOBILE=1 next build` -> export statico in `.next-mobile/`, niente server, niente
  middleware, niente route handler.

Il trucco che tiene fuori le API dall'export e `pageExtensions: ["tsx"]`: ogni route
handler e un `.ts`, ogni pagina e un `.tsx`. Senza questo l'export fallisce.

Comando unico: `npm run build:ios` (build mobile + `cap sync ios`).

### Cosa e cambiato nel codice, e perche

- **Niente piu pagine server.** Le sei pagine erano server component che leggevano
  Supabase col cookie di sessione e passavano tutto a un `*Client`. Ora ognuna carica i
  propri dati nell'app, riusando i loader gia esistenti in `src/lib/data/*` (che erano
  gia `"use client"`: il refactor e stato quasi tutto cancellare, non scrivere).
- **`src/proxy.ts` eliminato.** Un bundle statico non ha un server dove far girare il
  middleware. La stessa regola (niente sessione -> `/login`) vive in
  `src/components/auth-gate.tsx`.
- **Sessione in localStorage, non nei cookie.** `src/lib/supabase/client.ts` usa
  `createClient` di `@supabase/supabase-js` (non piu `createBrowserClient` di
  `@supabase/ssr`): su schema custom i cookie non sono un archivio affidabile, il
  localStorage di WKWebView e nel container dell'app e sopravvive ai riavvii.
- **`/auth/callback` da route handler a pagina client.** Lo scambio PKCE deve avvenire
  dove sta il verifier, cioe nel browser che ha iniziato il login.
- **`/giorno/[date]` -> `/giorno?d=YYYY-MM-DD`.** Un segmento dinamico non si
  prerenderizza senza elencare tutti i giorni possibili.
- **`src/lib/api.ts`.** Tutte le `fetch("/api/...")` passano da `apiUrl()`: nell'app
  diventano assolute verso `NEXT_PUBLIC_API_BASE`. Da qui la sezione CORS in
  `next.config.ts` (l'app e un'origine diversa dalle API).
- **Font locali.** `next/font/google` -> `next/font/local` con i woff2 in `src/fonts/`
  (presi dai pacchetti @fontsource). Una build che deve raggiungere Google Fonts e una
  build che fallisce senza rete.
- **Splash onesta.** Spariva su un timer fisso di 1,1s: l'app non poteva essere piu
  veloce di quel timer. Ora esce quando la prima schermata dice di avere i dati
  (`src/lib/app-ready.ts`), con failsafe a 4s.
- **Face ID** in `src/components/biometric-lock.tsx`: all'avvio e al rientro da
  background dopo 3 minuti. Se non c'e ne biometria ne codice, non blocca (sarebbe una
  porta senza chiave).
- **Notifica serale** in `src/lib/native/reminders.ts`: `LocalNotifications` alle 21:30,
  ricorrente, ora locale del telefono. Notifica **locale**, non push: niente APNs,
  niente tabella di device token, niente cron — e suona anche senza segnale.

### Workflow di build (Manuel non apre il terminale)

`ios/.gitignore` **non** ignora `App/App/public` ne `capacitor.config.json`, al
contrario del default di Capacitor. Il bundle viene costruito e sincronizzato nel
sandbox e committato: sul Mac si apre `ios/App/App.xcodeproj` e si preme Run. Il prezzo
e un diff rumoroso a ogni modifica dell'interfaccia; e voluto.

### Attenzione: le env var finiscono DENTRO il bundle

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_API_BASE`
sono compilate dentro `ios/App/App/public`. Cambiare progetto Supabase vuol dire
**ricostruire e ri-sincronizzare**, non solo aggiornare Vercel.

### Aperti su questo fronte

- ~~Backend Supabase da ravvivare~~ **CHIUSO il 12 agosto.** Progetto nuovo
  `fljshsmpmpzapcczsbwc` (eu-north-1) in `manuelvisuals's Org`, collegato a
  `manuelvisuals/journal-me`, schema 001..005 applicato in un colpo solo dal SQL Editor
  e verificato (6 tabelle: entries 15 col., entry_goals, goals, recaps, remembers,
  user_settings). Chiave usata nel bundle: la **publishable** `sb_publishable_...`,
  non piu la anon JWT legacy.
  Il mistero di luglio e risolto: il vecchio progetto vive sull'account Supabase
  `karyaaaktas@gmail.com`, non su quello di Manuel. Da li la pausa e l'impossibilita di
  riattivarlo. Non ci sono dati da recuperare.
- **Da fare su Vercel** (UI, Manuel): aggiornare `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` sul nuovo progetto, e confermare che `OPENAI_API_KEY`
  ci sia ancora.
- **Migrations e GitHub:** il progetto e collegato al repo ma manca `supabase/config.toml`
  e i file sono `001_...` invece che `<timestamp>_...`, quindi il deploy automatico delle
  migration NON e attivo. Per ora si passa dal SQL Editor.
- **Registrazione**: il guscio usa ancora la pipeline WebRTC/Realtime dentro WKWebView,
  bug A compreso. Da valutare il passaggio a registrazione nativa full-clip verso
  `/api/transcribe-fallback`: perde la trascrizione dal vivo, guadagna affidabilita.
- **Icona app** provvisoria (l'icona web riscalata a 1024). Merita un mockup vero.
- **Bundle id** `com.manuelvisuals.journalme`, scelto senza conoscere le convenzioni
  usate su stoqfolio.
