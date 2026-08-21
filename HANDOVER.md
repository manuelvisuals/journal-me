# Handover · Journal.me

Documento di riferimento per chi (Claude o umano) riprende lo sviluppo.
Aggiornato al **20 agosto 2026**. Lo stato del lavoro in corso e in §13.
Per il lavoro in corso (desktop, due modalita, temi) vedi §13 e le due SPEC in root.

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

## 2. Dove si lavora (organizzazione cartelle)

**Tutto vive nel repo.** Si lavora su un clone fresco di `main`
(https://github.com/manuelvisuals/journal-me), si committa, si pusha: auto-deploy su
Vercel. Non esistono copie di lavoro sul Mac di Manuel — niente mirror locali, niente doc
sul Desktop. Se un file conta, sta nel repo; se non sta nel repo, non esiste.

Motivo: in passato il progetto viveva in tre posti (mirror in `~/Documents`, clone in
`/tmp`, GitHub) e le copie andavano fuori sync, generando handover sbagliati.

Documenti versionati nella root e in `design/`:

```
HANDOVER.md                  questo file, unica fonte di contesto
SPEC-temi.md                 contratto dei token e temi. E la PR 0 di v2
SPEC-v2.md                   desktop + due modalita (locale/cloud). 13 PR in ordine
HANDOVER-recording-bug.md    referto del bug mic iOS (utile finche e aperto, vedi §8)
AUDIT-tre-esperti.md         audit di giugno, stato aggiornato in §9
design/brandbook.html        fonte di verita del look (diventa: contratto + tema wine)
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
Vercel:   journal-me-weld.vercel.app         (team Hodl Inc, auto-deploy on push to main)
          il vecchio journal-me-chi.vercel.app (team spammingmadh52-3011s) e
          abbandonato: il suo webhook GitHub era morto dal 14 giugno
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
Aggiunti il 17 agosto: `desktop-v1`, `due-modalita`, `temi` (vedi §13).

---

## 6. Stato reale del codice

`main` a `d1da4ef` (agosto 2026). L'MVP e completo e in produzione: tutte le sezioni
esistono, salvano su Supabase e sono state verificate in Chrome sul deploy live.

### Navigazione

Tab bar a 5 slot: **Oggi** (`/`) · **Mese** (`/mese`) · **mic centrale ambra** (apre la
registrazione via `/?record=1`) · **Ricorda** (`/remember`) · **Impostazioni**
(`/settings`). Recap non e piu un tab: su desktop e una voce della rail sinistra,
sul telefono si raggiunge dalla card editoriale in cima a Impostazioni.

### Route

```
/                    Today (empty / recording / review / processing / people /
                     filled / manual / no-capture — macchina a stati in today-client)
/giorno?d=YYYY-MM-DD Dettaglio giorno, riusa FilledView con tutti i controlli
                     (era /giorno/[date]: un segmento dinamico non si
                     prerenderizza nell'export statico del guscio iOS)
/mese                Feed infinito newest-first, sticky month header, jump picker
/recap               Segmented Mensili/Semestrali/Annuali + detail con dropcap
/remember            Filtri a chip, raggruppamento per fascia temporale, quick-capture
/settings            "Impostazioni": elenco a gruppi + pannelli (obiettivi, tema, lingua, dati)
/benvenuto           La scelta locale/cloud al primo avvio (PR 5)
/login               Codice a 6 cifre via email (niente piu magic link)
/auth/callback       Scambio code -> sessione (PKCE)
```

### API (tutte server-side, la chiave OpenAI non tocca mai il browser)

Tutte dietro `requirePremium` (401 senza token, 402 senza premium) tranne
dove indicato. Il client le chiama SOLO via `apiFetch` (bearer + timeout).

```
/api/transcribe-fallback   trascrizione dell'intero clip (gpt-4o-transcribe)
/api/process-entry         gpt-4o-mini -> headline, snippet, aree macro
/api/split-by-date         gpt-4o-mini -> smista un racconto multi-giorno
/api/extract-people        gpt-4o-mini -> persone citate nella giornata
/api/remember/classify     gpt-4o-mini -> riclassifica le note in persona/todo/luogo/idea
/api/recap/generate        gpt-4o (non mini, serve la prosa) -> recap letterario
/api/usage                 consumi AI del mese (requireUser: basta essere loggati)
/api/stripe/checkout       sessione di Checkout (requireUser: compra chi NON e premium)
/api/stripe/webhook        l'unico posto che scrive profiles.plan (firma Stripe)
```

**Cancellate:** `/api/realtime/session` (con la PR 1: non aveva piu chiamanti)
e `/api/demo` (con la PR 5: il tour anonimo e stato sostituito dalla modalita
locale). Se le trovi citate altrove in un documento, il documento e vecchio.

### Livello dati

`src/lib/data/{entries,goals,recaps,remembers}.ts`. **Non esiste piu il ramo
localStorage**: anche la demo passa da Supabase (account condiviso `demo@journal.me`).
Il parametro `mode` sopravvive nelle firme solo per stabilita dei call-site ed e ignorato.

### Migration

```
001_init.sql              entries, goals, entry_goals, remembers, recaps + RLS + seed goal
002_user_settings.sql     user_settings.glossary (legacy, vedi sotto)
003_entry_goals_jsonb.sql entries.goals_on jsonb
004_remove_libro.sql      toglie 'libro' dal check di remembers.kind
005_entry_people.sql      entries.people jsonb
006_profiles.sql          profiles (plan/plan_source/current_period_end) + trigger + RLS
007_user_settings_theme.sql  user_settings.theme, user_settings.appearance
008_profiles_stripe.sql   profiles.stripe_customer_id + unique index
009_ai_usage.sql          ai_usage (token ufficiali per chiamata) + RLS + indice
010_default_goals.sql     riscrive seed_default_goals() con i sei micro-goal nuovi
```

**Tutte e dieci applicate su `fljshsmpmpzapcczsbwc`, verificato il 20 agosto
2026** interrogando `information_schema` (e `pg_proc` per la 010) invece di
fidarsi degli appunti: 004 risultava "da confermare" ed era gia applicata, 008
risultava non applicata ed era gia applicata, 009 mancava davvero ed e stata
eseguita quel giorno; la 010 e stata applicata la sera dello stesso giorno e
verificata leggendo il corpo della funzione (`prosrc like '%mosso il corpo%'`)
piu il trigger `seed_goals_on_user_create` su `auth.users`, ancora abilitato.
Morale: prima di riscrivere una migration, chiedi al database.

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

**D. ~~Migration 004~~ CHIUSO il 20 agosto.** Verificata applicata: il check
di `remembers.kind` e gia senza 'libro'. Vedi §6 per lo stato di tutte e nove.

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
  attuale; spaziature a mano invece di un ritmo 8pt; icone "Oggi" (mirino) e "Impostazioni"
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
2. **Se stai per implementare v2, leggi `SPEC-temi.md` e poi `SPEC-v2.md`.** Sono la
   specifica approvata del lavoro in corso, e contengono le trappole gia mappate sul
   codice reale (file e riga). Vedi §13.
3. Leggi la memoria persistente (`MEMORY.md` e i file topic: progetto, temi, brandbook,
   utente, workflow, bug registrazione, feedback verify-before-claiming-fixed).
4. Clona `main` e guarda `git log --oneline -15`: e la foto piu aggiornata che esista.
5. Chiedi a Manuel una cosa sola: da dove si riparte.
6. Mockup prima del codice se si tocca il visivo. Push solo dopo tsc + eslint + OK.

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
- ~~Da fare su Vercel~~ **CHIUSO il 12 agosto.** Progetto reimportato nel team
  **Hodl Inc** (`vercel.com/hodl-inc/journal-me`), dominio
  **`journal-me-weld.vercel.app`**, con `OPENAI_API_KEY` (chiave nuova),
  `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Il progetto vecchio (team `spammingmadh52-3011s-projects`, dominio
  `journal-me-chi.vercel.app`) e abbandonato: il repo risultava collegato ma il webhook
  non arrivava piu, ultimo deploy `c1b8d30` del 14 giugno. Le sue env var sono marcate
  **Sensitive**, quindi la vecchia `OPENAI_API_KEY` non e leggibile da nessuno: per
  questo se n'e fatta una nuova invece di recuperarla.
  **Nota sulle env var di Vercel:** vengono lette al build. Aggiungerne una NON aggiorna
  il deploy gia in produzione — serve un nuovo build.
- **Migrations e GitHub:** il progetto e collegato al repo ma manca `supabase/config.toml`
  e i file sono `001_...` invece che `<timestamp>_...`, quindi il deploy automatico delle
  migration NON e attivo. Per ora si passa dal SQL Editor — o, quando la finestra
  di Chrome non e in primo piano e il dashboard non disegna niente, dalla
  Management API di Supabase (`POST https://api.supabase.com/v1/projects/<ref>/
  database/query`) chiamata via `fetch` dalla scheda del dashboard gia loggata:
  usa il token di sessione del dashboard, che la pagina rinnova da sola a ogni
  navigazione, e non richiede nessuna chiave di servizio.
- **Registrazione**: il guscio usa ancora la pipeline WebRTC/Realtime dentro WKWebView,
  bug A compreso. Da valutare il passaggio a registrazione nativa full-clip verso
  `/api/transcribe-fallback`: perde la trascrizione dal vivo, guadagna affidabilita.
- **Icona app** provvisoria (l'icona web riscalata a 1024). Merita un mockup vero.
- **Bundle id** `com.manuelvisuals.journalme`, scelto senza conoscere le convenzioni
  usate su stoqfolio.

---

## 13. Journal.me v2 — desktop, due modalita, temi (progettato il 17 agosto 2026)

Progettazione chiusa e approvata da Manuel. **Stato implementazione (19 agosto 2026):**

- **PR 1 `api-auth`: fatta e verificata in produzione** (commit `6ef18fc`). Tutte le
  route AI dietro `requirePremium` (401/402), migration `006_profiles.sql` applicata,
  `SUPABASE_SERVICE_ROLE_KEY` nelle env Vercel, `apiFetch()` con bearer e timeout,
  `/api/realtime/session` cancellata. Manuel e `premium` (`plan_source=manual`).
- **PR 0 `temi`: fatta.** Contratto in `src/themes/contract.ts`, cinque temi
  (`minimal` default, `wine`, `carta`, `malva`, `macchina`), validatore di contrasto
  (10/10 set passano), boot script inline senza flash, `Impostazioni > Tema` con switch
  chiaro/scuro/sistema e griglia con anteprime vive. `globals.css` rifattorizzato:
  zero colori di marca letterali (tutto token o `color-mix` su token), radii e
  spaziatura sui token (`--jm-*`), sei famiglie font locali in `layout.tsx`.
  **Non ancora migrate ai ruoli tipografici** le taglie px degli schermi mobile
  esistenti: migrano con le PR 6-10 quando i componenti vengono riscritti sul
  contratto (deviazione deliberata dal passo 0.3, per non toccare il telefono).
  Migration `007_user_settings_theme.sql` (colonne theme/appearance).
- **PR 2 `store-interface`: fatta** (commit `7e97470`). JournalStore + CloudStore
  (spostamento puro), facade con `_mode` invariato, azioni AI in `src/lib/actions/`
  con check `can()`, backup export/import v1 nello store.
- **PR 3 `store-local`: fatta.** Dipendenza `idb`; `LocalStore` completo su IndexedDB
  (db `journalme` v1: entries/goals/remembers/recaps/drafts/meta, seed dei sei goal
  alla creazione, id `crypto.randomUUID()`); `resolveStorageMode()` asincrona con
  stato `resolving` (flag `jm.mode` sincrono PRIMO, poi `getAccessToken()`, poi
  `none`) + `useStorageMode()`; in modalita locale il client Supabase NON viene
  costruito (AuthGate e theme-runtime a import dinamico solo nel ramo cloud,
  env senza non-null assertion, prewarm silenziato). Verificato con Playwright:
  con `jm.mode=local` l'app si apre senza login, salva una giornata in IndexedDB
  con titolo di fallback e fa ZERO richieste esterne; senza flag il giro cloud e
  identico a prima. Nessuna UI imposta ancora il flag: arriva con `/benvenuto` (PR 5).
- **PR 4 `backup` + PR 5 `onboarding`: fatte** (un commit solo: costruite e
  verificate insieme). Backup v1: `src/lib/backup/backup.ts` (export web via
  Blob/download, iOS via @capacitor/filesystem + share — pacchetti committati in
  node_modules e referenziati da Package.swift, serve **Reset Package Caches** in
  Xcode), import merge-mai-replace con report leggibile, sezione "I tuoi dati" in
  Altro, banner rosso-ambra dopo 14 giorni senza backup (o mai, con 7+ giornate),
  `eraseEverything()` con conferma a due passi. Onboarding: `/benvenuto` (mockup
  due-modalita §01 adattato alla colonna telefono), AuthGate a TRE esiti
  (locale / cloud / niente -> /benvenuto), **tour anonimo rimosso** dal login
  (il bottone ora porta a /benvenuto), in locale il mic apre la scrittura e il
  titolo e la prima riga (mockup §02). Verificato con Playwright: nuovo utente ->
  /benvenuto -> "inizia cosi" -> giornata scritta e salvata in IndexedDB ->
  export -> re-import ("1 era gia qui") con ZERO richieste esterne e zero errori.
  NON fatto: backup automatico settimanale, migrazione locale->cloud, muro
  premium coi lucchetti (PR 10), aggiornamento del bundle iOS (`npm run
  build:ios` da rifare quando si rilascia sul telefono).
- **PR 6 `desktop-shell`: fatta.** Capitolo 20 del brandbook (focus/hover: outline
  ring accent 45% + hover a un passo di scala — outline e non box-shadow, per non
  toccare le ombre dei bottoni) e regola `:focus-visible` globale. `src/components/
  desktop/`: `desktop-shell.tsx` (sotto lg e `display:contents`, il telefono non se
  ne accorge; da lg griglia rail 222px + colonna + rail destra 296px, nascosta se
  vuota), `rail-left.tsx` (nav dal mockup: Oggi/Mese/Ricorda/Recap/Impostazioni + Racconta
  a voce — che in locale diventa "Scrivi la giornata" — account badge
  Premium/Cloud/Locale), `rail-right.tsx` (slot via portal: le pagine riempiono la
  colonna destra con `<RailRight>`). Tab bar spenta con `lg:hidden` in
  tab-bar.tsx (una riga, i 12 call-site intatti). Colonne pagina a
  `lg:max-w-[660px]`. Oggi (giornata piena): metriche/obiettivi/persone migrano
  nella rail destra a lg, `lg:hidden` sotto. Le decisioni aperte di spec §10.7
  chiuse come nel mockup approvato: Recap di primo livello, etichetta "Ricorda"
  (si cambia in NAV_ITEMS). Verificato con Playwright a 1440px (rail, nav,
  rail destra, tab bar assente) e a 430px (zero regressioni, tab bar intatta).
  NON fatto (PR 7-9): editor desktop con autosave e footer, focus mode,
  scorciatoie/palette, mese a griglia.
- **Trappola sandbox scoperta oggi:** `pkill -f "next dev"` uccide anche il comando
  bash che lo contiene (il pattern matcha la propria command line) e lascia vivo
  `next-server`: sembrava un problema di CSS non compilato ed era un server
  zombie. Pattern giusti: `pkill -9 -f 'next[-]server'; pkill -9 -f 'next [d]ev'`.
- **PR 7 `desktop-editor`: fatta.** Da lg la colonna centrale di Oggi E l'editor
  (mockup desktop-v1 §01): niente overlay, si arriva e si scrive. Tipografia
  CONFORME al brandbook cap. 03 — font UI del tema, 17/400/1.6: la deroga
  Spectral di spec §5.3 e stata proposta a Manuel e RIFIUTATA (19 ago, opzione
  "Inter, regola attuale"); il serif resta il marcatore del registro AI. Caret
  accent, placeholder serif corsivo "Com'e andata oggi?", click ovunque nella
  colonna mette il fuoco. Footer 74px: "salva e basta" (Cmd+S, `skipAI` in
  saveRecording — prima riga come titolo, zero AI) e "chiudi la giornata"
  (Cmd+Invio, AI dove c'e); in locale un solo bottone. Autosave bozze (§6):
  `drafts.ts` scrive su IndexedDB in ENTRAMBE le modalita (in cloud apre
  un'istanza LocalStore dedicata, la bozza non passa mai dalla rete), 800ms di
  debounce sia nell'editor desktop sia in ManualWrite (telefono), flush su
  unmount, indicatore "salvato ora / N min fa" solo a scrittura riuscita, bozza
  cancellata SOLO a giornata salvata (runSave). Al mount di Oggi la bozza piu
  recente della entry riapre l'editor con avviso "bozza non salvata,
  recuperata". Focus mode (§5.5): `focus-toggle.tsx`, stato in sessionStorage,
  attributo `data-focus` su html, CSS solo nel blocco lg (rail+header+footer
  spariscono, nota "esc per uscire" in portal su body perche l'header che
  ospita il bottone e nascosto), Esc esce, si spegne da solo a giornata
  chiusa. Refactor: `rail-today.tsx` (la rail destra di Oggi, condivisa tra
  scrittura e giornata piena), `use-is-desktop.ts` (matchMedia sullo stesso
  lg, per i punti dove cambia il COMPORTAMENTO, non il layout), pipeline unica
  `runSave` (voce/review, ManualWrite, editor desktop). Su desktop toccare
  metriche/obiettivi dalla rail NON chiude l'editor. Verifica Playwright
  24/24: 1440px (tipografia, autosave in IDB dopo 800ms, ripresa dopo reload,
  focus on/off, Cmd+S, bozza cancellata post-save, 0 errori console) e 430px
  (tab bar intatta, overlay invariato, bozza riapre l'overlay). NON fatto:
  Cmd+K/palette e scorciatoie globali (PR 8 — per questo l'hint del footer non
  cita ancora la palette), mese a griglia (PR 9), aree su due colonne nella
  giornata piena desktop (mockup §03, arrivera come rifinitura), ricerca
  full-text.
- **PR 8 `shortcuts`: fatta.** `use-shortcuts.ts` (UN posto solo, montato in
  DesktopShell): Cmd+S salva senza AI, Cmd+Invio chiude la giornata, Cmd+K
  palette, Cmd+Shift+F focus (solo su Oggi, dove esiste l'editor), Cmd+Shift+R
  registrazione. Regole spec §5.4 rispettate: `isComposing` saltato, metaKey su
  Mac / ctrlKey altrove (MAI tutti e due alla cieca — nei test Playwright su
  Linux si usa Control), niente Cmd+1..5 ne lettere nude, sotto lg e sulle
  pagine bare i listener non fanno nulla. Cmd+S/Cmd+Invio dentro l'editor li
  gestisce l'editor (che ha il testo) con preventDefault; il listener globale
  controlla `defaultPrevented` e non spara due volte, e fuori dal fuoco
  rilancia un CustomEvent `jm:shortcut` che l'editor montato ascolta.
  `command-palette.tsx`: store modulo aperta/chiusa (stesso pattern del
  focus), Vai a (Oggi/Mese/Ricorda/Recap/Impostazioni), Racconta a voce / Scrivi la
  giornata, Modalita focus (solo pathname "/"), e cattura rapida in Ricorda
  (qualsiasi testo digitato -> "Salva in Ricorda", feedback inline, si chiude
  da sola senza portarti via dalla pagina; l'auto-classificazione AI del tipo
  NON c'e qui — l'appunto nasce 'nota', la si puo aggiungere dopo). Niente
  ricerca full-text (spec §10.4, fuori dalle 11 PR). FocusEscape (nota "esc
  per uscire" + listener Esc) spostato dal bottone al guscio: il focus si
  spegne con Esc anche su pagine senza bottone. Hint "⌘K comandi" nel footer
  editor e "⌘⇧R" nella rail. Verifica Playwright 21/21 a 1440px e 430px
  (palette apre/naviga/cattura con verifica su /remember, focus on/off,
  Cmd+S a fuoco fuori dal textarea, phone intatto, 0 errori console).
- **PR 9 `mese-griglia`: fatta.** `mese-grid.tsx` (mockup desktop-v1 §04):
  griglia 7 colonne celle 112px da lg, lunedi primo giorno, fuori-mese senza
  bordo, oggi con bordo sinistro ambra + gradiente caldo, futuri al 30%,
  vuoti passati "vuota" in serif corsivo (come nel mockup approvato; la spec
  diceva "trattino" ma il mockup vince), headline clampata a 3 righe + i sei
  goal-dot per cella. Click su giornata piena -> /giorno; su oggi vuoto -> /.
  Il titolo del mese apre lo JumpPicker esistente; su desktop il picker
  cambia il mese della GRIGLIA (cache `deskCache` separata dal feed: il feed
  e una lista cronologica e appenderci mesi arbitrari la romperebbe). Il
  feed verticale resta intatto sotto lg. Rail destra: statistiche del mese
  calcolate in locale senza AI (giornate X/Y, umore medio grezzo 1..5 con
  virgola it, giorni col goal piu frequente, parole scritte) — esistono
  anche in gratis; card Pattern come TEASER ONESTO senza numeri inventati
  (la lettura vera arriva col motore pattern M4, gating in PR 10). BONUS da
  feedback di Manuel ("il body e ancora portrait"): FilledView §03 — stili
  migrati da inline a classi jm-fv-* (valori telefono replicati ESATTI e
  verificati via computed-style), da lg headline 27px, snippet serif corsivo
  17, aree macro su due colonne a card. TRAPPOLA SCOPERTA: le utility
  Tailwind v4 stanno in @layer, il CSS nudo di globals.css no — quindi
  `lg:hidden` PERDE contro un `display:flex` scritto in una classe custom
  (successo con .jm-month-header): in quei casi serve un `display:none`
  esplicito nel blocco lg. Verifica Playwright 27/27 + riesecuzione di
  PR 7 (24/24) e PR 8 (21/21) su build pulita.
- **PR 10 `gating-ui`: fatta.** `src/lib/plan.ts`: piano free/premium lato
  client SOLO per la UI (cache sincrona in localStorage `jm.plan` + refresh
  in background da profiles.plan; ottimista "premium" finche non si sa —
  mai lucchetti a sproposito per chi paga; MAI in locale: aspetta
  resolveStorageMode e non costruisce Supabase). `can()` ora plan-based
  (`sync` sempre acceso in cloud) + `useCan()` reattivo. `premium-wall.tsx`
  (mockup due-modalita §04): montato nel guscio, funziona anche sotto lg,
  compare SOLO su azione (mic, "vedi" del nudge, Genera recap) — mai
  all'avvio; "non ora"/Esc = uscita gratuita contestuale (dal mic si apre
  la scrittura); "prova premium" porta al login in locale, in cloud gratis
  dice onestamente che l'acquisto arriva (Stripe = PR 11; NIENTE prezzo nel
  bottone: e ancora da decidere). Giornata gratis (mockup §02): FilledView
  con `freeProse` — sub "scritta/raccontata alle H:MM", il TUO testo come
  prosa serif, nudge premium unico che non blocca; sparita la bugia "aree
  macro non ancora estratte". apiFetch: un 402 apre il muro (import
  dinamico) e la Response resta ai chiamanti (fallbackAIFields intatto).
  Prewarm della trascrizione solo con can("voice") — un 402 di background
  avrebbe aperto il muro all'avvio. BUG FIXATO: remember-client chiamava
  /api/remember/classify anche in locale (violava "mai /api in locale");
  ora dietro can("aiSummary"). Pill "premium" sulla card Pattern del Mese.
  IN PIU (feedback Manuel "sfrutta BENE lo spazio"): contenitori desktop
  allargati — Mese lg:max-w-[1080px], tutte le altre pagine 860px — con il
  testo da leggere/scrivere tenuto a riga leggibile (editor e notice 680px
  centrati, prosa/snippet 700px). Verifica Playwright 25/25 (muro da mic/
  nudge/recap, prova premium -> login, ZERO richieste esterne in locale
  monitorate su desktop e telefono, larghezze) + regressione PR 7 (24/24),
  PR 8 (21/21), PR 9 (25/25 — i check sulle aree ora iniettano il DOM:
  in locale la vista gratis mostra prosa, non aree).
- **Larghezze desktop: DECISIONE DI MANUEL (19 ago, esplicita e con
  priorita) — larghezza FLUIDA su tutte le pagine.** Niente max-width per
  pagina da lg (`lg:max-w-none` ovunque): ogni pagina riempie la colonna
  disponibile e i margini interni fissi (24-28px) sono l'unica cosa fissa.
  Il vecchio 660px del mockup vale solo per il TESTO: editor 680px e prosa
  serif 700px restano a riga di lettura, centrati/limitati dentro la
  colonna fluida. Non reintrodurre cap di larghezza sulle pagine senza
  chiederglielo. Fix collegato: AuthGate rimbalzava a / anche gli utenti
  LOCALI da /login — ora il rimbalzo dalle pagine d'ingresso vale solo con
  sessione cloud (auth === "in"), altrimenti il "prova premium" del muro
  era un vicolo cieco.
- **PR 11 `pagamento`: codice completo, in attesa SOLO dell'account
  Stripe di Manuel.** PREZZO DECISO da Manuel il 19 ago: 4,99 EUR/mese
  (etichetta in `src/lib/pricing.ts`, il prezzo vero lo detta
  STRIPE_PRICE_ID). `requireUser` in entitlement.ts (autenticato ma NON
  premium: il checkout lo apre chi sta comprando) + `getAdminClient()`
  esportato per il webhook. `/api/stripe/checkout`: sessione subscription
  con client_reference_id e metadata.user_id, locale it, success
  /settings?upgraded=1; se le env Stripe mancano risponde 503 col
  messaggio onesto. `/api/stripe/webhook`: firma verificata sul body
  GREZZO (constructEventAsync), checkout.session.completed -> plan
  premium + plan_source stripe + stripe_customer_id + current_period_end
  (dagli item della subscription: nell'API 2025+ current_period_end sta
  su SubscriptionItem, non sulla Subscription); subscription.updated/
  deleted -> plan da status (active/trialing/past_due = premium), mappato
  via metadata.user_id o stripe_customer_id. Migration 008
  (stripe_customer_id + unique index) SCRITTA ma NON ancora applicata in
  prod. Muro premium: in cloud "prova premium . 4,99 EUR al mese" apre il
  checkout (redirect a session.url), 503 -> nota onesta; in locale ->
  /login come prima. Dipendenza npm `stripe` 22.5.0. MANCANO (bloccati
  sull'account Stripe che deve creare Manuel — creazione account e roba
  sua): prodotto+price sul dashboard Stripe, STRIPE_SECRET_KEY /
  STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET su Vercel, endpoint webhook
  registrato su Stripe (https://journal-me-weld.vercel.app/api/stripe/
  webhook), test end-to-end con carta di test. Niente trial per ora
  (spec §10.1 parlava di "primo mese incluso": da decidere).
  ATTENZIONE BROWSER: durante questa PR la sessione claude-in-chrome si e
  riattaccata a un Chrome SBAGLIATO (Browser 1, account Supabase
  karyaaaktas@gmail.com — non e Manuel). Prima di qualsiasi operazione
  Supabase/Vercel verificare SEMPRE con list_connected_browsers +
  AskUserQuestion che il browser sia quello di Manuel (era Browser 2,
  deviceId 7306a5ae-...). Nessun danno fatto: tab chiusa subito.
- **Decisioni di Manuel (19 ago, sera): pagamenti RIMANDATI** — ha gia uno
  Stripe per Xenovision e se ne riparla piu avanti; il codice della PR 11
  resta deployato e inerte (503 onesto). **Mockup della PR 12 APPROVATO**
  ("ok, approvato design"): si puo scrivere il codice del marketplace
  seguendo design/mockups/marketplace-temi.html.
- **Contatore consumi AI (0771765):** tabella `ai_usage` (migration 009 —
  ATTENZIONE: al momento del commit NON ancora applicata in prod, il
  browser di Manuel era disconnesso; applicarla alla prima occasione via
  SQL Editor), logAiUsage fire-and-forget in tutte e sei le route AI coi
  token UFFICIALI del campo usage di OpenAI, GET /api/usage con aggregato
  mensile e stima USD (listini istantanea ago 2026 in ai-usage.ts:
  gpt-4o-mini 0,15/0,60 $/M, gpt-4o 2,5/10 $/M, gpt-4o-transcribe
  0,006 $/min). Finche la migration non gira, il log fallisce in silenzio
  per design e le risposte non ne risentono. Ordine di grandezza dei
  costi: giornata a voce ~3 min ≈ 2 centesimi $ (dominata dall'audio,
  ~0,6 c/min), giornata scritta+AI ≈ 0,1 c, recap mensile (gpt-4o) ≈ 5-6 c.
  I modelli 4o sono LEGACY nell'agosto 2026: valutare un passaggio ai
  modelli correnti (famiglia 5.x, molto piu economici dopo i tagli di
  luglio 2026) come ottimizzazione futura.
- La PR 12 (marketplace temi) e APPROVATA nel design e non ancora
  implementata.
- **20 agosto 2026 — giro di bugfix, nessuna funzione nuova.** Sei
  correzioni uscite dalla rilettura integrale del codice, piu la
  migration 009 finalmente applicata.
  1. **Il mic della cattura rapida in Ricorda non era protetto.**
     `quick-capture.tsx` montava `RecordingOverlay` senza nessun
     `can("voice")`: in modalita locale premere quel microfono mandava
     l'audio a `/api/transcribe-fallback`. Era l'ULTIMO buco nella
     promessa "in locale nemmeno una richiesta di rete" (l'altro,
     `/api/remember/classify`, era stato chiuso nella PR 10). Ora apre
     il muro premium; il campo di testo accanto resta l'uscita gratuita.
  2. **`/benvenuto` prometteva "primo mese incluso"** e aveva il prezzo
     scritto a mano. Il trial non esiste da nessuna parte: la sessione
     Stripe non ha `trial_period_days`. Il prezzo ora viene da
     `src/lib/pricing.ts`, che espone anche `PREMIUM_HAS_FREE_TRIAL =
     false`: finche quella costante e falsa nessuna schermata puo
     promettere un mese gratis. Se un giorno il trial si attiva, si
     accende li e si aggiunge al checkout.
  3. **Il titolo di Ricorda diceva ancora "Remember"** (P2 dell'audit di
     giugno), come pure due stringhe in `people-review`. Tab bar, rail e
     palette dicevano gia "Ricorda".
  4. **`clearPlanCache()` non era chiamata da nessuna parte.** Il piano
     e cache in `localStorage` ("jm.plan") ed e OTTIMISTA: dopo un logout
     restava "premium" addosso al browser, e il prossimo account gratis
     vedeva la UI premium fino al refresh in background — cioe un 402 a
     sorpresa, che SPEC-v2 §3.3 vieta esplicitamente. Ora il logout la
     chiama.
  5. **Pulizia:** `src/lib/types/speech.d.ts` eliminato (i tipi Web Speech
     non servono da quando la trascrizione e full-clip); `navigator.platform`
     (deprecato) sostituito da `userAgentData`/`userAgent` in
     `use-shortcuts.ts`; il warning del ref della waveform chiuso copiando
     `barRefs.current` dentro l'effetto; `argsIgnorePattern: "^_"` in
     `eslint.config.mjs`, perche i `_mode` sono deliberati (spec §2.2) e
     non devono sporcare ogni lint. `npx eslint .` ora e a **zero warning**.
  6. **Migration 009 applicata** (vedi §6). Da qui in avanti `logAiUsage`
     scrive davvero e `/api/usage` ha dati da aggregare.
  7. **Rail destra su tre righe e obiettivi cliccabili** (commit `272e127`):
     `MetricCards` nella rail sbordava di 31px appena si apriva l'editor del
     mood, e i pallini degli obiettivi erano bersagli da 14px. Ora una riga
     per metrica con l'editor sotto a tutta larghezza (`rail-metrics.tsx`) e
     caselle da 22px dentro righe da 44px.
  8. **Migration 010 applicata la sera stessa** (vedi §6): i micro-goal di
     default per i nuovi utenti non sono piu la lista personale di maggio.
     `default-goals.ts` tiene la stessa lista per la modalita locale.
  9. **`madh52@gmail.com` promosso a premium a mano**, su richiesta di
     Manuel: `update public.profiles set plan='premium',
     plan_source='manual', current_period_end=null where user_id =
     'd771049e-b74e-4476-b36e-51d6bb569b2f'`. Nessun cliente Stripe
     collegato, quindi il webhook non ha niente da sovrascrivere; se un
     giorno quell'account paga davvero, il webhook riscrivera plan_source a
     `stripe`. Lato client basta ricaricare l'app: `plan.ts` rilegge
     `profiles.plan` in background a ogni load e sostituisce la cache
     `jm.plan`, senza bisogno di rifare il login.

  10. **"Altro" e diventato "Impostazioni"** (mockup impostazioni.html
     §03/§04, approvato). Era un cassetto: banner, card Recap, temi,
     obiettivi a chip, dati, account e logout tutti aperti nella stessa
     colonna, senza gerarchia. Ora e un elenco a gruppi dove ogni riga
     dice la cosa E il suo valore attuale (quanti obiettivi, che tema,
     quante giornate), e cio che vuole spazio si apre in un pannello con
     un "indietro": Obiettivi, Tema, "Dove sono le mie giornate".
     Su desktop l'identita passa nella rail destra e la card Recap
     sparisce dalla colonna (Recap e gia nella rail sinistra); sul
     telefono succede il contrario. File nuovi: `settings/rows.tsx`
     (SetGroup, SetRow, PanelHead) e `settings/panels.tsx`;
     `appearance-section.tsx` e `goals-section.tsx` sono spariti,
     `data-section.tsx` e rimasto solo col banner. Tolti da globals.css
     11.471 caratteri di CSS che non aveva piu nessun utente.

     **Due righe del mockup NON sono state implementate, di proposito.**
     "Promemoria della sera" mostrerebbe un orario senza che arrivi mai
     nessuna notifica: l'app non ha un sistema di notifiche. "Lingua"
     mostrerebbe un selettore che non traduce niente: il bilingue e la
     task 27 e non esiste ancora. Sono la stessa bugia del "primo mese
     incluso" tolto la mattina dello stesso giorno, e tornano nel
     momento in cui esiste la cosa che promettono.

  11. **Bilingue italiano/inglese in tutta l'app** (task 27). Il modello:
     **la chiave di traduzione E la frase italiana** — `t("Esci
     dall'account")`, non `t("settings.account.logout")`. Tre motivi: il
     codice resta leggibile senza aprire un secondo file; se una frase non
     e tradotta esce in italiano invece di mostrare una chiave al cliente;
     e si scrive un catalogo solo (`src/lib/i18n/en.ts`, 370 voci) invece
     di due. Il difetto noto — cambiare la frase italiana scollega la
     traduzione in silenzio — e coperto da `scripts/verify-i18n.mjs`, che
     fallisce sia sulle frasi senza traduzione sia sulle traduzioni
     rimaste orfane.

     **La lingua la sceglie il dispositivo**, come chiesto: la preferenza
     di default e "system" e `navigator.language` decide al primo avvio.
     Da Impostazioni > Lingua si puo forzare italiano o inglese, e si puo
     TORNARE all'automatico (chi cambia telefono altrimenti non avrebbe
     piu modo di farlo).

     **Perche la traduzione si accende dopo l'idratazione.** Il server non
     sa che lingua ha il dispositivo e renderizza sempre in italiano. Se
     il client partisse subito in inglese React troverebbe un HTML diverso
     da quello atteso e urlerebbe in console — e le suite Playwright
     falliscono su "zero errori console". Quindi `t()` risponde italiano
     finche `LangWatcher` non chiama `markHydrated()`: un render in piu,
     zero mismatch.

     **Cambia anche cio che scrive l'AI.** `apiFetch` manda `x-jm-lang` e
     le sei route AI scelgono la lingua dell'output (`src/lib/server/lang.ts`).
     Un'interfaccia inglese che genera un titolo in italiano e tradotta a
     meta, cioe rotta. **Le etichette delle macro-aree restano pero in
     italiano** ('Lavoro', 'Relazioni', 'Corpo', 'Emozioni'): sono un enum
     salvato a database, non testo, e se l'AI cominciasse a scrivere
     'Work' le giornate vecchie e nuove dello stesso utente finirebbero
     con etichette diverse. A schermo le traduce `t()` come tutto il resto.

     **Numeri e date seguono la lingua**: `LOCALE` non e piu una costante,
     `format.ts` chiede il tag a `localeTag()` a ogni chiamata. Il peso si
     scrive 81,4 in italiano e 81.4 in inglese, e i nomi dei mesi arrivano
     da Intl — le tre liste `MONTHS_IT` copiate a mano sono sparite, come
     le tre copie di `periodLabel` (ora `src/lib/recap-labels.ts`).

  12. **Il codice di accesso e finito nel TITOLO della mail** (task 26).
     L'oggetto era "Il tuo codice Journal.me" e il numero stava solo nel
     corpo: iPhone la proposta di riempimento automatico la costruisce
     dal messaggio, e col numero nascosto dentro l'HTML bisognava aprire
     Mail, leggere, tornare indietro e ribattere sei cifre. Adesso
     l'oggetto **comincia** col codice:
     `{{ .Token }} e il tuo codice Journal.me / your Journal.me code`,
     e il corpo e stato riscritto in due lingue col codice grande in
     cima. Cambiati tutti e due i template — `magic_link` E `confirmation`,
     perche al PRIMO accesso di un'email nuova Supabase usa il secondo, ed
     era gia la trappola che aveva rotto il login a giugno.

     **Come e stato fatto, visto che il dashboard non si vede:** con la
     Management API (`PATCH /v1/projects/<ref>/config/auth`) chiamata dalla
     scheda Chrome gia loggata, come per le migration (vedi §6). I template
     precedenti sono salvati nel localStorage di quel browser sotto
     `jm.backup.mailer.20260820`: se il nuovo non piace, si rimettono da li
     senza doverli riscrivere a memoria.

  13. **La dimensione dell'interfaccia si puo cambiare** (Impostazioni >
     Lingua e aspetto > Dimensione del testo). E accessibilita, non una
     preferenza: Manuel non vede bene e l'app gli era troppo piccola.

     **Perche zoom e non font piu grandi.** In globals.css ci sono 166
     misure di testo scritte in pixel, e accanto altezze e spaziature
     anch'esse in pixel: scalare solo i font vuol dire testo grande dentro
     righe rimaste piccole. Convertire tutto in rem sarebbe la strada da
     manuale ma tocca ogni riga del foglio di stile. Si usa `zoom` sulla
     radice, provato nel browser PRIMA di scriverlo: ingrandisce testo,
     spazi e bersagli insieme, gli overlay `fixed` continuano a coprire lo
     schermo, la tab bar resta in fondo.

     **L'unica cosa che lo zoom rompe e `100dvh`**: dentro una radice
     zoomata al 125% vale il 125% dello schermo, e su una pagina vuota
     compare una barra di scorrimento. I tredici punti sono diventati la
     classe `.jm-screen`, cioe `calc(100dvh / var(--jm-ui-scale))`.

     Cinque passi (0,9 / 1 / 1,15 / 1,3 / 1,5). La scala si applica nello
     script inline di boot, insieme a tema e chiaro/scuro: applicarla da
     React vorrebbe dire vedere l'app piccola per un istante e poi
     saltare. Nel pannello **ogni riga e disegnata alla sua misura** e non
     c'e nessun tasto "salva": chi apre quella schermata lo fa perche non
     vede bene, e deve poter scegliere guardando.

     `src/lib/ui-scale-contract.ts` non importa React di proposito: lo
     importa anche `themes/boot.ts`, che gira come modulo server, e un
     solo hook li dentro fa fallire la compilazione della pagina.

  14. **Dalla giornata si puo aggiungere qualcosa** (`/giorno`). Prima era
     un vicolo cieco: una giornata vuota diceva "vai su Oggi" e una gia
     raccontata non poteva ricevere una riga in piu. Ora un tasto in fondo
     al racconto (non nell'intestazione: lassu ci sono gia indietro,
     originale ed elimina, e un quarto bersaglio sarebbe appiccicato al
     cestino) apre un foglio con tre voci: scrivi altro, racconta a voce,
     salva in Ricorda.

     Sotto il cofano non c'e niente di nuovo: `ManualWrite`,
     `RecordingOverlay` e `QuickCapture` sono gli stessi di Oggi e di
     Ricorda, e `saveRecording` con `defaultDate` accodava gia al
     transcript esistente. **La voce non compare in gratis** — assente,
     non spenta con la targhetta "Premium": quello e solo un modo elegante
     di dire di no (SPEC-v2 §3.3).

     Se l'utente sposta la data dentro l'overlay di registrazione, vince
     lui: il foglio non riporta di forza il testo su questa giornata.

  15. **La dimensione del testo rifatta: si scala SOLO il testo** (21
     agosto). La prima versione usava `zoom` sulla radice e cresceva tutto
     insieme, margini compresi: sullo schermo entrava la stessa quantita
     di parole, solo piu grosse. Manuel l'ha bocciata in mezz'ora ("il gap
     destra e sinistra cambia, volevo solo il font") e aveva ragione: chi
     ingrandisce il testo lo fa per LEGGERE DI PIU. Ora ogni misura di
     testo del progetto — 175 in globals.css, 14 dai token dei temi, 37
     inline, 9 in classi Tailwind — e `calc(<valore> * var(--jm-ui-scale))`.
     Margini e larghezze non si toccano; `.jm-screen` e tornata a 100dvh
     perche senza zoom non c'era piu niente da correggere. Il test misura
     margine sinistro e larghezza del contenuto a ogni scala: se qualcuno
     riprova con lo zoom, fallisce.

  16. **L'avviso di caricamento, uno per tutta l'app**
     (`src/components/ui/toast.tsx`). Premevi "Continua" per aggiungere
     testo a una giornata e per qualche secondo non succedeva niente:
     nessuna rotella, nessuna scritta. Store nel modulo come premium-wall
     e palette, montato una volta sola nel layout, tre stati (loading che
     dura finche non lo sostituisci, ok 2,5s, errore 6s). Lo usano
     l'aggiunta a una giornata, il salvataggio del transcript e
     l'eliminazione; le schermate che gia avevano un'attesa visibile
     (Oggi con "elaborazione", Recap col tasto che cambia testo) non ne
     hanno bisogno e non lo usano — un secondo avviso sopra un'attesa gia
     mostrata e rumore.

  17. **BUG VERO: il testo aggiunto finiva su un ALTRO giorno.** Manuel ha
     detto "non li salva". Il database ha detto un'altra cosa: alle
     09:27:15 del 21 agosto l'entry del 2026-08-20 era stata aggiornata,
     con il separatore dell'append dentro. Salvava eccome — sul giorno
     sbagliato. Causa: `saveRecording` chiama `/api/split-by-date`, che
     legge i marker temporali del testo ("ieri", "lunedi") e sposta il
     racconto sulla data giusta. Su Oggi e cio che serve; su `/giorno` no,
     perche la data l'hai gia scelta tu aprendo quella schermata, e il
     testo spariva da sotto gli occhi. Aggiunta l'opzione `skipSplit`, che
     AddToDay passa sempre. Se la data viene spostata a mano nel
     registratore l'avviso lo dice invece di tacere.

     **Da qui una regola:** quando "non salva", chiedere al database prima
     di leggere il codice. Sarebbe bastato un `select` per non cercare nel
     posto sbagliato.

  18. **Passare da un tab all'altro era lento: cache + precaricamento**
     (`src/lib/data/cache.ts`, `warm.ts`). Ogni schermata caricava i suoi
     dati al montaggio e in cloud ogni lettura e un giro fino a Supabase,
     rifatto da capo a ogni ritorno. Ora le letture passano da una cache
     in memoria (60 secondi, stale-while-revalidate: la seconda visita
     disegna subito e rilegge in sottofondo) e, appena la PRIMA schermata
     e pronta, gli altri tab si precaricano da soli.

     La cache sta dentro `src/lib/data/*.ts` — l'unico punto d'accesso ai
     dati — e non nelle pagine: cosi una schermata scritta domani la
     eredita senza saperlo. **L'invalidazione e grossolana di proposito:**
     qualsiasi scrittura svuota tutto. Una giornata salvata cambia anche
     il conteggio del mese, i micro-goal di quel giorno e magari un
     remember estratto; tenere quella mappa a mano e il tipo di cosa che
     si rompe in silenzio sei mesi dopo. **Attenzione:** le scritture che
     NON passano da `data/*.ts` (saveRecording, generateAndSaveRecap,
     import ed erase del backup) chiamano `invalidateAll()` a mano — se se
     ne aggiunge una e ci si dimentica, l'app mostra dati vecchi fino allo
     scadere del minuto.

  **Verificato**, non dichiarato: `npx tsc --noEmit` e `npx eslint .` puliti;
  `next build` (web) e `JM_MOBILE=1 next build` (export statico iOS) entrambi
  verdi; le suite Playwright rieseguite senza regressioni (PR 7 24/24,
  PR 8 21/21, PR 9 25/25, PR 10 26/26) piu quattro nuove:
  `scripts/verify-fix-20260820.mjs` 52/53, `scripts/verify-impostazioni.mjs`
  55/55, `scripts/verify-i18n.mjs` 6/6 (analisi statica del catalogo),
  `scripts/verify-lingua.mjs` 25/25 (l'app vera, in tutte e due le lingue) e
  `scripts/verify-testo-giorno.mjs` 46/46 — che fra le altre cose misura
  margine sinistro e larghezza del contenuto a ogni misura del testo, cioe
  la cosa che Manuel ha chiesto — e `scripts/verify-toast-cache.mjs` 12/12,
  che riproduce il bug del giorno sbagliato scrivendo "ieri" dentro il testo
  e ricaricando la pagina.

  L'unico FAIL, `benvenuto: zero errori console`, e un artefatto
  dell'ambiente e non una regressione: senza `.env.local` il client
  Supabase urla "Supabase non configurato" e `/benvenuto` lo costruisce.
  Verificato rimettendo il `src` di `eb93806` sullo stesso dev server:
  fallisce identico anche li. Da rifare quando l'ambiente ha le env.

  **NON fatto, e da decidere:** `/api/usage` non ha ancora nessuna schermata
  che lo mostri (il contatore consumi esiste solo lato server: serve un
  mockup prima); il bundle iOS in `ios/App/App/public` e ancora
  pre-temi, quindi `npm run build:ios` va rifatto prima di rimettere le mani
  sul telefono; l'append-by-default di una giornata gia scritta in locale
  tiene il titolo della PRIMA riga scritta quel giorno, che e coerente col
  mockup ("il titolo e la prima riga") ma sorprende chi crede di riscrivere.

**Cosa cambia.** L'app diventa usabile a schermo intero su MacBook con la tastiera
(oggi e una colonna da 440px in mezzo allo schermo), l'ingresso della giornata su desktop
diventa la scrittura invece del microfono, e nascono **due modalita**: una versione gratis
che tiene tutto sul dispositivo e non fa **nessuna** richiesta di rete, e una premium con
cloud e AI. Sopra a tutto, un sistema di **temi** con due assi indipendenti (identita del
tema, e chiaro/scuro/sistema).

**Dove sta la specifica.**

```
SPEC-temi.md                       contratto dei token, 5 temi, appearance. PR 0
SPEC-v2.md                         architettura dati, gating, layout desktop. PR 1..12
design/mockups/temi.html           i 5 temi in chiaro e scuro + picker
design/mockups/desktop-v1.html     Oggi, focus, giornata piena, Mese a griglia
design/mockups/due-modalita.html   scelta iniziale, giornata gratis, backup, muro premium
```

**Le tre cose da sapere prima di aprire qualsiasi file.**

1. **P0 di sicurezza, indipendente dal resto.** Nessuna delle route sotto `/api/*` rifiuta
   una richiesta non autenticata, e il CORS e `*`. Chiunque conosca
   `journal-me-weld.vercel.app` puo spendere la chiave OpenAI. Finche l'app era privata era
   teorico; distribuendola non lo e piu. E la PR 1 e va fatta comunque.
   Collegato: `/api/realtime/session` non ha piu nessun chiamante
   (`src/lib/realtime/prewarm.ts:8-9`) ed e da **cancellare**, non da proteggere.
2. **La PR 0 (temi) viene prima di tutto il visivo.** Il grosso dei componenti nuovi nasce
   nelle PR 6-10: se il contratto dei token arriva dopo, quei componenti nascono con
   valori letterali dentro e vanno riscritti.
3. **Il brandbook cambia ruolo.** Da "il look dell'app" a due cose: il contratto (regole
   valide per ogni tema) e la definizione del tema `wine`. Serve un capitolo 00 che lo
   dica, altrimenti ogni revisione futura bocciera i temi citando il brandbook.
   Il tema di **default** e `minimal` (Inter + Newsreader), non `wine`.

**Le trappole gia mappate** (dettaglio con file e riga nelle spec): `AuthGate` manda a
`/login` chiunque non abbia sessione, e un utente locale non ne ha mai; la tab bar non e in
`layout.tsx` ma la rendono dodici punti, e si spegne con `lg:hidden` in
`src/components/ui/tab-bar.tsx:108`; `resolveMode()` e per forza asincrona; le funzioni dati
hanno `_mode` come primo parametro su 26 call-site; `saveRecording` e `generateAndSaveRecap`
chiamano `/api/*` dal livello dati e vanno spostate fuori dallo store.

**Trappola di verifica dei mockup.** Il sandbox non raggiunge `fonts.googleapis.com`,
quindi un mockup renderizzato li dentro mostra **Georgia** al posto di ogni serif senza
dirtelo, e ogni giudizio sui font che ne esce e falso. Procedura corretta in
`SPEC-temi.md`, in testa al documento.

**Ancora aperto:** prezzo dell'abbonamento; App Store rinviato a dopo il web; capitolo 20
del brandbook per focus e hover su desktop (oggi non esiste nessuno stato
`:focus-visible` in tutto il repo); Recap come voce di primo livello o dentro Altro;
privacy policy e termini, che servono anche per la sola versione gratis.

---
