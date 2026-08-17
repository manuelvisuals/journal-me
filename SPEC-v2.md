# SPEC v2 · Journal.me — desktop e due modalita

Specifica di implementazione. Scritta il 17 agosto 2026 su `main` a `d1da4ef`.
Destinatario: chi scrive il codice, senza il contesto della conversazione in cui e nata.

Prima di toccare qualsiasi cosa, leggi `HANDOVER.md` (stato del progetto, regole
operative, trappole gia pagate) e `design/brandbook.html` (fonte di verita del look).
Se questa spec e il codice si contraddicono, vince il codice — e poi correggi qui.

Mockup approvati che questa spec descrive:

```
design/mockups/desktop-v1.html     Oggi, modalita focus, giornata piena, Mese a griglia
design/mockups/due-modalita.html   scelta iniziale, giornata gratis, backup, muro premium
design/mockups/temi.html           stessa schermata in quattro temi + picker
```

**`SPEC-temi.md` viene prima di questo documento.** Il contratto dei token e la PR 0: il
grosso dei componenti nuovi nasce nelle PR 6-10, e se i token arrivano dopo quei componenti
vanno riscritti. Non iniziare dalla PR 1 senza aver letto anche quella spec.

---

## 1. Cosa si sta costruendo, e perche

Journal.me oggi e un'app mobile-first, voice-first, cloud-only, con un solo utente.
Questa versione cambia tre cose insieme:

1. **Desktop.** Il posto in cui l'app viene usata davvero e un MacBook a colazione, a
   schermo intero, con la tastiera. Oggi quel caso d'uso e servito da una colonna
   `max-w-[440px]` centrata su uno schermo vuoto (`src/app/page.tsx:68` e stesso pattern
   negli altri client), che e la cosa sbagliata.
2. **Scrittura prima della voce.** Su desktop l'ingresso della giornata e una textarea,
   non un microfono. La voce resta, ma diventa l'azione secondaria.
3. **Due modalita.** Una versione **gratis** che tiene tutto sul dispositivo dell'utente
   e non parla con nessun server, e una versione **premium** con cloud e AI.

La terza e l'unica che tocca l'architettura. Le prime due sono UI.

### Il modello mentale delle due modalita

|                        | Locale (gratis)                  | Cloud (premium)                    |
|------------------------|----------------------------------|------------------------------------|
| Account                | nessuno                          | Supabase (codice 6 cifre via email)|
| Dati                   | IndexedDB sul dispositivo        | Postgres Supabase, RLS per utente  |
| Chiamate a `/api/*`    | **mai, nemmeno una**             | tutte, autenticate                 |
| Scrittura giornata     | si                               | si                                 |
| Voce e trascrizione    | no                               | si                                 |
| Titolo, sintesi, aree  | no (titolo = prima riga scritta) | si                                 |
| Recap, pattern         | no                               | si                                 |
| Obiettivi, metriche    | si                               | si                                 |
| Ricorda                | si (solo manuale)                | si (+ estrazione automatica)       |
| Piu dispositivi        | no                               | si                                 |
| Backup                 | export/import file, a mano       | il cloud e il backup               |

Regola che tiene in piedi tutto: **in modalita locale l'app non fa nemmeno una richiesta
di rete.** Non e una preferenza, e la promessa che viene fatta all'utente nella schermata
di scelta. Se un giorno un endpoint viene chiamato in modalita locale, quella promessa
diventa una bugia. Vale anche per font, analytics, error reporting: niente.

I font sono gia locali (`src/app/layout.tsx:17-38`, `next/font/local` sui woff2 in
`src/fonts/`), quindi quella meta della promessa e gia mantenuta. **Il punto che oggi la
romperebbe e un altro:** `AuthGate` (`src/components/auth-gate.tsx:31-47`) e montato su
ogni route da `layout.tsx:87-89` e costruisce il client Supabase con
`autoRefreshToken: true`. Senza sessione non fa rete, ma un utente che passa da cloud a
locale con un token scaduto ancora in storage genera un refresh verso `/auth/v1/token`.
Quindi: **in modalita locale il client Supabase non va costruito affatto** — import
dinamico dentro il solo ramo cloud, e `AuthGate` non lo monta prima di conoscere la
modalita. Come corollario, un build solo-locale non deve richiedere
`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`, che oggi sono lette con non-null assertion
(`src/lib/supabase/client.ts:26-39`) e farebbero esplodere il primo render.

---

## 2. Architettura dati

### 2.1 Il problema

Oggi `src/lib/data/{entries,goals,recaps,remembers}.ts` parlano direttamente a Supabase.
Il ramo localStorage e stato cancellato a maggio. Serve rimetterlo, ma con una forma sola.

### 2.2 La forma

Un'interfaccia, due implementazioni, una factory. Le funzioni pubbliche gia esistenti
**mantengono nome e firma**, primo parametro `_mode: DataMode` compreso, e diventano
wrapper sottili sopra lo store. Il parametro resta ignorato come oggi: la modalita la
decide la factory, non il chiamante. Cosi i 26 call-site nella UI non vengono toccati in
questa PR e il diff resta leggibile — ma **nessun call-site cambia comportamento**, che e
una promessa piu debole e piu vera di "nessun call-site viene toccato".

```
src/lib/data/store/
  types.ts        JournalStore (l'interfaccia) + BackupFile + ImportReport
  cloud.ts        CloudStore   — il corpo delle funzioni attuali, spostato
  local.ts        LocalStore   — IndexedDB
  index.ts        getStore(), resolveMode(), setMode()
```

L'interfaccia deve coprire **tutte** le funzioni pubbliche che esistono oggi. Sono 20,
non 12: prima di scriverla, apri i quattro file e conta.

```ts
// src/lib/data/store/types.ts
export type StorageMode = "local" | "cloud";

export interface JournalStore {
  readonly mode: StorageMode;

  // entries.ts
  loadTodayEntry(): Promise<Entry | null>;
  loadEntryForDate(dateISO: string): Promise<Entry | null>;
  loadMonthEntries(year: number, month: number): Promise<Entry[]>;
  deleteEntry(dateISO: string): Promise<void>;
  updateEntryTranscript(dateISO: string, text: string): Promise<Entry>;
  updateMetric(dateISO: string, patch: Partial<EntryMetrics>): Promise<Entry>;
  toggleGoal(dateISO: string, label: string): Promise<Entry>;
  saveEntryPeople(dateISO: string, people: string[]): Promise<void>;

  // goals.ts
  loadGoalDefs(): Promise<GoalDef[]>;
  addGoal(label: string): Promise<GoalDef>;
  removeGoal(id: string): Promise<void>;

  // remembers.ts
  loadRemembers(): Promise<Remember[]>;
  addRemember(text: string, kind: RememberKind, source: RememberSource): Promise<Remember>;
  deleteRemember(id: string): Promise<void>;
  updateRememberKind(id: string, kind: RememberKind): Promise<void>;
  loadPersonaNames(): Promise<string[]>;
  addPersonas(names: string[]): Promise<void>;

  // recaps.ts
  loadRecaps(): Promise<Recap[]>;
  updateRecap(id: string, patch: Partial<Recap>): Promise<void>;

  // backup
  exportAll(): Promise<BackupFile>;
  importAll(file: BackupFile): Promise<ImportReport>;
}
```

**Attenzione a `updateMetric`, `toggleGoal` e `saveEntryPeople`.** Non accettano un
`Partial<Entry>` generico: `updateMetric` prende `Partial<EntryMetrics>` e mappa a mano su
`weight_kg` / `sleep_hours` / `mood` (`entries.ts:320-339`); `toggleGoal` prende una
`label` e fa il toggle case-insensitive dentro `goals_on` (`entries.ts:353-378`);
`saveEntryPeople` e un UPDATE puro. Restano com'e: **non unificarle in un `upsertEntry`
generico** in questa PR, sarebbe un secondo refactor mascherato dentro il primo.

**Due funzioni restano deliberatamente FUORI dallo store**, perche non sono accesso ai
dati ma orchestrazione che chiama `/api/*` dal livello dati:

- `saveRecording` (`entries.ts:274`, chiama `/api/split-by-date` e `/api/process-entry`)
- `generateAndSaveRecap` (`recaps.ts:95`, chiama `/api/recap/generate`)

Vanno spostate in `src/lib/actions/` e devono controllare `can("aiSummary")` prima di
partire. E qui che la regola "in locale nemmeno una richiesta" si difende davvero: se
restassero dentro `JournalStore`, `LocalStore` dovrebbe implementarle con un `throw`, e la
promessa dipenderebbe dal fatto che per caso nessuno le chiami.

`monthBoundaries` (`recaps.ts:63`) e una funzione pura di calcolo date: resta dov'e.

`LocalStore` implementa tutta l'interfaccia. `updateRecap` in locale lancia
`new Error("recap non disponibile in locale")`: meglio un metodo che esplode che
un'interfaccia con meta dei metodi opzionali.

### 2.3 Risoluzione della modalita

```ts
// src/lib/data/store/index.ts
export type ResolvedMode = "resolving" | "local" | "cloud" | "none";

// Ordine di risoluzione, una volta sola al boot. E ASINCRONA.
//   1. flag "jm.mode" === "local" in localStorage        -> "local"  (sincrono, primo)
//   2. await getAccessToken()  -> token valido           -> "cloud"
//   3. nessuno dei due                                   -> "none", si va a /benvenuto
```

Tre cose non negoziabili qui:

- **Non leggere a mano la chiave `sb-<ref>-auth-token`.** E una convenzione interna di
  supabase-js che puo cambiare a una minor, e dal blob non si vede se il token e scaduto.
  Usa `getAccessToken()`, che **esiste gia** in `src/lib/supabase/client.ts:49-52` e fa
  `auth.getSession()`. Non riscriverla.
- Siccome `getSession()` e asincrona, `resolveMode()` e asincrona, quindi lo stato
  `resolving` **deve esistere**. E lo stesso stato `"unknown"` che `AuthGate` gia gestisce
  (`auth-gate.tsx:8,65`): riusa quel modello, non inventarne un secondo.
- Il ramo 1 va **prima** del 2 proprio perche e sincrono: un utente locale non deve mai
  aspettare una promise di Supabase per vedere la sua app, e in modalita locale il client
  Supabase non si costruisce nemmeno (§1).

La modalita si risolve **una volta sola per sessione** e si tiene in un modulo. Non
leggerla dentro i componenti: esporre un hook `useStorageMode()` che legge il valore gia
risolto tramite `useSyncExternalStore`, non `useEffect` + `setState` (lint React 19, vedi
HANDOVER §7).

### 2.4 LocalStore

IndexedDB via il pacchetto [`idb`](https://www.npmjs.com/package/idb) (~1,5 kB, tipizzato).
Non `localStorage`: i transcript sono testo lungo e il limite dei 5 MB si raggiunge in
meno di due anni di diario.

Database `journalme`, versione 1, object store:

```
entries    keyPath "entryDate"                  index: nessuno (le query sono per range di data)
goals      keyPath "id"
remembers  keyPath "id"                         index "kind"
recaps     keyPath "id"
drafts     keyPath "entryDate"                  { entryDate, text, updatedAt }
meta       keyPath "key"                        { key, value }
```

Chiavi in `meta`: `schemaVersion`, `lastBackupAt`, `onboardingDone`, `deviceLabel`.

`loadMonthEntries(y, m)` usa `IDBKeyRange.bound("YYYY-MM-01", "YYYY-MM-31")` sul keyPath:
le date ISO si ordinano lessicograficamente, quindi non serve un indice.

Gli id in locale si generano con `crypto.randomUUID()`.

**Micro-goal in locale.** Su cloud i sei goal di default arrivano da un trigger Postgres
su `auth.users`. In locale non c'e nessun trigger: al primo avvio in modalita locale
`LocalStore` semina la stessa lista. Le etichette di default vanno messe in **un solo
posto**, `src/lib/data/store/default-goals.ts`, e importate sia dal seed locale sia dalla
migration (come commento di riferimento). HANDOVER §7 dice "micro-goal 100% da DB, nessun
hardcode": quella regola nasceva per impedire un fallback che mascherava una query rotta.
Un seed esplicito alla creazione del database non e un fallback, ed e ammesso — ma **solo**
alla creazione, mai come default a runtime.

### 2.5 Persistenza dello storage (importante)

Su web, IndexedDB e cancellabile dal browser sotto pressione di spazio, e Safari applica
un limite di 7 giorni allo script-writable storage per i siti senza interazione. Un diario
che sparisce e un disastro. Difese, in quest'ordine:

1. `navigator.storage.persist()` chiesto **una volta**, subito dopo che l'utente ha scelto
   la modalita locale (non prima: la richiesta va fatta dopo un gesto dell'utente o viene
   negata in silenzio). Registrare l'esito in `meta`.
2. Il banner backup (§4) diventa insistente dopo 14 giorni senza export.
3. Nella schermata di scelta e in "I tuoi dati", dire la verita: **questo e l'unico posto
   dove esistono queste giornate.**

Dentro il guscio iOS il problema non esiste: IndexedDB in WKWebView sta nel container
dell'app e sopravvive finche l'app e installata. Il caso fragile e il web su Safari.

### 2.6 CloudStore

E il codice di oggi, spostato. Non riscriverlo. Attenzione a portarsi dietro le
particolarita gia pagate:

- `entries` **non ha** la colonna `duration_seconds`. Metterla in un `select` rompe
  silenziosamente tutta la query.
- Le letture di `people` sono difensive: se la colonna manca si ricade sulle colonne base.
- `saveEntryPeople` e solo UPDATE, mai INSERT (altrimenti crea giornate senza headline).

---

## 3. Entitlement e gating

### 3.1 Il buco che c'e adesso — P0, va chiuso in ogni caso

**Nessuna delle sette route sotto `/api/*` rifiuta una richiesta non autenticata**, e
`Access-Control-Allow-Origin: *` in `next.config.ts`. Chiunque conosca l'URL di
`journal-me-weld.vercel.app` puo chiamare `/api/process-entry` o `/api/recap/generate`
e spendere la chiave OpenAI di Manuel. Finche l'app era privata era un rischio teorico.
Nel momento in cui viene distribuita, l'URL e pubblico dentro il bundle: **smette di
essere teorico**. Va chiuso prima di qualsiasi distribuzione, indipendentemente dal resto
di questa spec.

Precisazione su `/api/realtime/session`: quella route **legge** un utente
(`route.ts:79-82`), quindi non e vero che nessuna route tocca l'autenticazione. Ma non e
un gate: la `getUser()` sta dentro un `try/catch` best-effort usato solo per costruire il
glossario, e il POST prosegue verso OpenAI anche con `user === null` (`route.ts:179`). In
piu usa `createClient()` di `src/lib/supabase/server.ts`, che legge la sessione **dai
cookie**, mentre la sessione vive in localStorage: `getUser()` torna sempre `null` e tutto
quel ramo e codice morto. E soprattutto **quella route non ha piu chiamanti**:
`src/lib/realtime/prewarm.ts:8-9` lo dichiara esplicitamente e l'unico fetch rimasto punta
a `/api/transcribe-fallback`. Quindi `/api/realtime/session` non va protetta: **va
cancellata**. E una lambda esposta che puo spendere la chiave OpenAI e che non serve piu a
nessuno.

### 3.2 Come si chiude

**Migration `006_profiles.sql`:**

```sql
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
  plan_source text,                        -- 'stripe' | 'manual' | 'apple'
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);
-- nessuna policy di insert/update: solo il service role scrive il piano.
```

Piu un trigger su `auth.users` che crea la riga con `plan = 'free'`, sullo stesso modello
del trigger che semina i goal in `001_init.sql`.

**Helper server** `src/lib/server/entitlement.ts`:

```ts
// Legge il bearer token dall'header Authorization, verifica l'utente con il
// service role, poi legge profiles.plan.
// Ritorna { userId, plan } oppure una Response gia pronta:
//   401 se il token manca o non e valido
//   402 se plan !== 'premium'
export async function requirePremium(req: NextRequest):
  Promise<{ userId: string } | NextResponse>;
```

Da applicare come **prima riga** di ogni route in:

```
/api/process-entry        /api/split-by-date       /api/extract-people
/api/remember/classify    /api/recap/generate      /api/transcribe-fallback
```

E da **cancellare**, non proteggere: `/api/realtime/session` (vedi §3.1).

Il client (che tiene la sessione in localStorage, non nei cookie — vedi HANDOVER §12)
deve mandare `Authorization: Bearer <access_token>` su ogni chiamata. Il posto giusto
per farlo e **dentro `src/lib/api.ts`**: aggiungere un `apiFetch(path, init)` che
inietta l'header (via `getAccessToken()`, gia esistente in
`src/lib/supabase/client.ts:49` — non riscriverla) e centralizza anche il timeout (§7.3).

I punti da centralizzare sono esattamente sette, verificati sul codice:
`entries.ts:57`, `entries.ts:75`, `recaps.ts:107`, `today-client.tsx:64`,
`remember-client.tsx:61`, `recording-overlay.tsx:449`, `prewarm.ts:25`.
Nessuna `fetch("/api/...")` sparsa deve sopravvivere a questa PR.

`Access-Control-Allow-Origin: *` puo restare: senza un token valido un'origine qualsiasi
non ottiene niente. Ma va tolto il commento in `next.config.ts` che dice "no credentials
travel", perche da qui in avanti viaggia un bearer token.

### 3.3 Lato client

```ts
// src/lib/capabilities.ts
export type Capability = "voice" | "aiSummary" | "recap" | "patterns" | "sync";
export function can(c: Capability): boolean;   // false in locale, plan-based in cloud
```

Il client usa `can()` **solo per la UI** (mostrare il lucchetto, aprire il muro premium).
La decisione vera resta sul server. Non deve mai esistere una schermata in cui il client
crede di poter chiamare un endpoint e si becca un 402 a sorpresa.

---

## 4. Backup: formato e comportamento

### 4.1 Il file

Un solo JSON, nome `journal-me-backup-YYYY-MM-DD.json`.

```json
{
  "format": "journal.me/backup",
  "version": 1,
  "exportedAt": "2026-08-17T08:12:00+02:00",
  "source": { "mode": "local", "app": "1.4.0" },
  "counts": { "entries": 127, "goals": 6, "remembers": 41, "recaps": 0 },
  "entries": [],
  "goals": [],
  "remembers": [],
  "recaps": []
}
```

Gli oggetti dentro gli array sono **esattamente** i tipi di `src/lib/types.ts`. Nessuna
trasformazione: se il tipo cambia, `version` sale e si scrive un migratore in
`src/lib/backup/migrate.ts`. Il file non e cifrato: e l'utente che decide dove metterlo,
ed e piu importante che sia leggibile fra dieci anni che protetto da una password che
perdera.

### 4.2 Export

- Web: `Blob` + `URL.createObjectURL` + `<a download>`.
- iOS: `@capacitor/filesystem` in `Directory.Cache` + `@capacitor/share`, cosi esce il
  foglio di condivisione ed entra in File / iCloud Drive / dovunque.
- Dopo un export riuscito, scrivere `lastBackupAt` in `meta`.

### 4.3 Import

Strategia **merge, mai replace**:

| Tipo       | Chiave naturale             | Se esiste gia                              |
|------------|-----------------------------|--------------------------------------------|
| entries    | `entryDate`                 | salta, a meno che l'esistente sia vuoto     |
| goals      | `label` (case-insensitive)  | salta                                       |
| remembers  | `text` + `kind`             | salta                                       |
| recaps     | `periodType` + `periodStart`| salta                                       |

**Gli `id` non si trasportano.** In import vengono rigenerati, e `Remember.sourceEntryId`
viene azzerato. Motivo concreto: `001_init.sql:129` dichiara
`source_entry_id uuid references entries(id) on delete set null`; se una entry viene
saltata perche la sua data esiste gia nella destinazione, un remember che punta al suo id
fa fallire l'insert con violazione di foreign key. Oggi il campo e sempre `null` nei fatti
(`remembers.ts:70`), quindi il bug e latente — ma il backup v1 semplicemente **non
trasporta il legame entry-remember**, e va scritto qui perche nessuno lo scopra dopo.

Al termine mostra un `ImportReport` leggibile: *"Aggiunte 41 giornate. 86 erano gia qui.
Nessuna e stata sovrascritta."* Un import non deve **mai** poter distruggere dati
esistenti senza una conferma esplicita e separata.

### 4.4 Il banner

In modalita locale, se `lastBackupAt` e piu vecchio di 14 giorni (o non esiste e ci sono
almeno 7 giornate), compare la card rossa di `due-modalita.html` schermata 03 in cima ad
"Altro", e un accenno discreto in fondo alla rail sinistra. Non deve comparire su Oggi
mentre si scrive: quello e lo spazio della scrittura.

---

## 5. Layout desktop

### 5.1 Breakpoint

Uno solo: **`lg` di Tailwind, 1024px.**

- `< 1024px`: nessuna modifica. Resta l'app di adesso, tab bar in basso compresa. Il
  telefono e il guscio iOS non devono accorgersi di niente.
- `>= 1024px`: layout desktop a tre colonne.

Non introdurre breakpoint custom. Non usare user-agent sniffing.

### 5.2 Struttura

```
src/components/desktop/
  desktop-shell.tsx     griglia a 3 colonne, rende rail + children + rail destra
  rail-left.tsx         brand, navigazione, "Racconta a voce", account + badge modalita
  rail-right.tsx        slot: ogni pagina passa il proprio contenuto
  command-palette.tsx   Cmd+K
  focus-toggle.tsx
```

`desktop-shell.tsx` avvolge il contenuto in `src/app/layout.tsx` e sotto `lg` non rende
nulla di suo. Non duplicare le pagine: **stessa route, stesso componente client, layout
diverso.** Se ti ritrovi a scrivere `today-client-desktop.tsx`, ti sei perso.

**La tab bar non si spegne da `layout.tsx`.** Non e renderizzata li: la rendono
dodici punti diversi dentro le pagine e i loro `loading.tsx` (`today-client.tsx:440`,
`mese-client.tsx:237`, `day-client.tsx:222`, `remember-client.tsx:180`,
`settings-client.tsx:121`, `recap-client.tsx:138`, `recap-detail.tsx:115`,
`app/page.tsx:83`, piu i quattro `loading.tsx`). Un wrapper li avvolge, non li disattiva:
a 1280px vedresti rail **e** tab bar. La correzione e una sola riga in un solo file —
`src/components/ui/tab-bar.tsx:108` prende `lg:hidden` — e i dodici call-site restano
invariati. Non toccarli.

Misure dai mockup: rail sinistra 222px, rail destra 296px, colonna di scrittura
`max-width: 660px` centrata, header 56px, footer azioni 74px.

### 5.3 L'editor

- Font: **Spectral 18px / peso 400 / line-height 1.55**, colore `--color-ink`.
  **Questa e una deroga esplicita al brandbook e va approvata prima di implementarla.**
  Il cap. 01 dice "Spectral per la prosa letteraria: recap, citazioni, titoli editoriali"
  e "due registri, mai mischiati": Spectral e il marcatore del registro AI-letterario, e
  metterlo sotto il testo grezzo dell'utente rende il diario scritto a mano e il recap
  mensile tipograficamente indistinguibili. L'alternativa conforme e **Inter 17/400/1.6**,
  che e la riga "Body 17 (transcript)" gia nel cap. 03. Se la deroga viene approvata,
  aggiungila al brandbook come emendamento invece di lasciarla implicita nel codice.
  In ogni caso il peso 300 su Spectral **non si usa**: non e nella scala e su fondo scuro
  risulta anemico.
- Caret ambra (`--color-accent`), che e gia il comportamento della registrazione.
- Placeholder in `--color-ink-faint`, italic serif: *"Com'e andata oggi?"*
- Nessun toolbar di formattazione. Testo puro. Se un giorno servira il grassetto sara
  Markdown, non una barra.
- Cliccare ovunque nella colonna centrale mette il fuoco nell'editor.

### 5.4 Scorciatoie

| Tasti          | Cosa fa                                          |
|----------------|--------------------------------------------------|
| `Cmd+S`        | salva la giornata senza AI                       |
| `Cmd+Enter`    | salva ed elabora con AI (solo premium)           |
| `Cmd+K`        | palette comandi: naviga, cerca, cattura in Ricorda|
| `Cmd+Shift+F`  | entra/esci dalla modalita focus                  |
| `Esc`          | esce dal focus, chiude la palette                |
| `Cmd+Shift+R`  | apre la registrazione                            |

Non usare `Cmd+1..5` per la navigazione: nel browser cambia scheda e non e intercettabile
in modo affidabile. La navigazione da tastiera passa dalla palette. Non usare nemmeno una
lettera nuda (`R`) per la registrazione: la colonna centrale e un editor di testo sempre a
fuoco, quindi scriveresti la scorciatoia invece di eseguirla.

Le scorciatoie vanno registrate in un solo posto,
`src/components/desktop/use-shortcuts.ts`, con un controllo su `event.isComposing` (o un
utente che scrive in cinese perde caratteri) e su `metaKey` vs `ctrlKey`.

### 5.5 Modalita focus

Nasconde entrambe le rail e l'header, lascia la colonna centrale e una scritta minuscola
"esc per uscire". Lo stato vive in `sessionStorage`, non in `meta`: e una preferenza del
momento, non una configurazione.

### 5.6 Mese a griglia

Solo `>= 1024px`. Griglia 7 colonne, celle 112px, giorni fuori mese senza sfondo, oggi
con bordo ambra e gradiente caldo, giorni futuri al 30% di opacita, giorni vuoti passati
con un trattino serif italic. Il feed verticale infinito attuale resta sotto `lg`.

La rail destra su Mese mostra le statistiche del mese (giornate raccontate, umore medio,
giorni per obiettivo, parole scritte). **Quelle si calcolano in locale, senza AI, e quindi
esistono anche in gratis.** La card "Pattern" sotto e premium.

---

## 6. Autosave delle bozze

Oggi, se chiudi la finestra mentre stai scrivendo a mano, perdi tutto. Su desktop, dove si
scrive per dieci minuti, e inaccettabile.

- Ogni **800ms di inattivita** la bozza va in `drafts` (IndexedDB, in **entrambe** le
  modalita: la bozza e sempre locale, anche per gli utenti cloud).
- Al mount di Oggi, se esiste una bozza per la data corrente ed e piu recente della entry
  salvata, si riapre l'editor con quel testo e un avviso discreto: *"bozza di ieri sera,
  non salvata"*.
- La bozza si cancella solo quando la giornata viene salvata con successo.
- L'indicatore in alto a destra dice `salvato ora` / `salvato 2 min fa`. Non deve mai
  dire "salvato" se la scrittura e fallita.

---

## 7. Onboarding, migrazione, robustezza

### 7.1 Onboarding

Nuova route `/benvenuto`, raggiunta quando `resolveMode()` torna `"none"`.

**Ostacolo che va rimosso prima, altrimenti la route e irraggiungibile.**
`src/components/auth-gate.tsx:10-12` considera pubblici solo `/login` e `/auth`, e senza
sessione Supabase sostituisce **qualunque** altro path con `/login` senza nemmeno
renderizzare i children (`auth-gate.tsx:57-67`). `AuthGate` avvolge tutto in
`layout.tsx:87-89`. Un utente in modalita locale non ha mai una sessione: verrebbe spedito
al login da ogni schermata, `/benvenuto` compresa. Serve quindi:

1. `/benvenuto` in `isPublicPath`;
2. `AuthGate` trasformato in un gate a **tre** esiti — sessione cloud / modalita locale /
   niente — invece dell'attuale binario "sessione o login".

Il punto 2 e il vero lavoro: oggi "nessuna sessione" significa incondizionatamente "vai al
login", ed e esattamente l'assunzione che le due modalita rompono.

Poi, due schermate, non di piu:

1. Benvenuto: cos'e Journal.me, in quattro righe.
2. La scelta locale/cloud di `due-modalita.html` schermata 01.

Scegliendo **locale**: si crea il database, si seminano i goal, si chiede
`storage.persist()`, si va su Oggi. Nessun account, nessuna email, nessuna schermata in
mezzo.

Scegliendo **premium**: si va al login a 6 cifre che esiste gia, poi al pagamento.

`/login` resta com'e. Il tour anonimo (`signInAnonymously()`, `src/app/login/page.tsx:93`)
va **tolto**: adesso il modo di provare l'app senza impegno e la modalita locale, che e
migliore in tutto. Questo chiude anche il debito documentato nel commento a
`src/app/login/page.tsx:75-88` — le giornate scritte dal tour restavano su un utente
anonimo orfano, e collegarci un'email dopo non e mai stato implementato.

### 7.2 Migrazione locale -> cloud

Quando un utente locale attiva premium:

1. Login / creazione account.
2. `LocalStore.exportAll()`.
3. `CloudStore.importAll()` con la stessa strategia di merge di §4.3.
4. Solo a upload **completato e verificato** (riconteggio delle giornate lato cloud), si
   scrive `mode = "cloud"` e si mostra il risultato: *"127 giornate caricate."*
5. **I dati locali non si cancellano.** Restano dove sono come rete di sicurezza, e "I
   tuoi dati" mostra un tasto per liberare lo spazio quando l'utente vuole.

Il percorso inverso (cloud -> locale) **non** si implementa come funzione: si fa con
export dal cloud e import in locale, che e la stessa cosa con meno codice da mantenere.

### 7.3 Timeout e messaggi d'errore

Debito aperto in HANDOVER §8 C-bis: le chiamate al backend non hanno timeout e il client
resta muto. Dentro `apiFetch` (§3.2):

- `AbortController` con timeout: 15s per le route testuali, 120s per la trascrizione.
- Ogni fallimento produce un messaggio leggibile, mai un silenzio. `402` ha un messaggio
  suo, che apre il muro premium invece di dire "errore".
- Se la trascrizione o l'elaborazione AI falliscono, **la giornata si salva lo stesso**
  col testo grezzo. Questo comportamento esiste gia (`fallbackAIFields`): non perderlo
  nel refactor.

---

## 8. Cosa non fare

- Non toccare il layout sotto 1024px. Nessuna regressione sul telefono, punto.
- Non duplicare i componenti pagina per il desktop.
- Non chiamare `/api/*` in modalita locale. Mai.
- Non fidarti di `can()` lato server.
- Non mettere `duration_seconds` in un select su `entries`.
- Non calcolare "oggi" con `new Date().getDate()`: solo `nowAppParts()` / `todayISO()` da
  `src/lib/format.ts`, che usano `APP_TZ = "Europe/Rome"`.
- Non usare `useEffect` + `setState` per leggere storage sincrono: `useSyncExternalStore`.
- Non aggiungere un secondo colore d'accento. Se ti serve, hai sbagliato gerarchia
  (brandbook, principio 02). Vale per ogni tema, non solo per `wine`.
- Non scrivere un `#`, una `rgba(` o un `px` dentro un `.tsx`. Dopo la PR 0 significa
  sempre che ti manca un token (vedi `SPEC-temi.md` §10).
- Nessuna emoji in codice, commit, config, markdown.
- Numeri in italiano via `LOCALE = "it-IT"` in `src/lib/format.ts`.

---

## 9. Ordine di lavoro

PR piccole, in quest'ordine. Ogni PR passa `npx tsc --noEmit` e `npx eslint .` prima del
push (regola non negoziabile, HANDOVER §4).

| #  | PR                        | Contenuto                                                                 | Dipende da |
|----|---------------------------|---------------------------------------------------------------------------|------------|
| 0  | `temi`                    | contratto dei token, `wine` estratto senza cambiamenti visivi, `globals.css` rifattorizzato, applicazione senza flash, quattro temi, validatore di contrasto, picker. **Vedi `SPEC-temi.md`** | — |
| 1  | `api-auth`                | `requirePremium`, migration 006, `apiFetch` con bearer e timeout, **cancellazione di `/api/realtime/session`** e dei 7 fetch sparsi | — |
| 2  | `store-interface`         | `JournalStore` (20 metodi), `CloudStore` (spostamento puro), facade con `_mode` invariato, `saveRecording` e `generateAndSaveRecap` spostate in `src/lib/actions/` | — |
| 3  | `store-local`             | dipendenza `idb`; `LocalStore`, seed goal, `resolveMode` asincrona con stato `resolving`, `useStorageMode`, client Supabase non costruito in locale | 2 |
| 4  | `backup`                  | dipendenze `@capacitor/filesystem` e `@capacitor/share` (+ commit dei pacchetti in `ios/`, vedi HANDOVER §12); export/import v1, banner, sezione "I tuoi dati" | 3 |
| 5  | `onboarding`              | `AuthGate` a tre esiti, `/benvenuto`, scelta modalita, rimozione tour anonimo | 3       |
| 6  | `desktop-shell`           | rail, griglia 3 colonne, breakpoint, `lg:hidden` sulla tab bar, account badge | 0, 3    |
| 7  | `desktop-editor`          | editor (ruolo `prose` del tema, §10.6), autosave bozze, footer azioni, focus mode | 6   |
| 8  | `desktop-shortcuts`       | `use-shortcuts`, palette Cmd+K                                            | 7          |
| 9  | `desktop-mese`            | griglia calendario + statistiche del mese in rail destra                  | 6          |
| 10 | `gating-ui`               | `capabilities`, lucchetti, muro premium, giornata gratis senza AI         | 1, 3       |
| 11 | `pagamento`               | Stripe checkout + webhook che scrive `profiles.plan`                      | 1          |
| 12 | `marketplace-temi`        | temi della community: import, pubblicazione, moderazione automatica sul contrasto. **Solo account cloud** | 0, 11 |

La PR 0 blocca tutte quelle visive (6, 7, 9, 10): dopo di lei nessun componente nuovo
contiene un valore di marca. Le PR 1 e 2 sono indipendenti da tutto e possono partire in
parallelo alla 0. La 1 va comunque fatta subito, anche se tutto il resto slitta.

Tre dipendenze npm nuove in totale (`idb`, `@capacitor/filesystem`, `@capacitor/share`).
Le due Capacitor non sono un semplice `npm install`: `ios/App/CapApp-SPM/Package.swift` le
referenzia per path dentro `node_modules`, quindi vanno committate come le tre gia presenti
(commit `adcb4ef`), e dopo serve **File > Packages > Reset Package Caches** in Xcode.

---

## 10. Decisioni non ancora prese

Vanno chiuse da Manuel, non dall'implementatore. Finche sono aperte, usa il valore
indicato fra parentesi come segnaposto e isolalo in una costante.

1. **Prezzo e periodo di prova** (segnaposto nei mockup: 4,99 EUR al mese, scritto "4,99 &euro;" in it-IT, primo mese
   incluso). Serve prima della PR 11.
2. **App Store.** Questa spec copre solo il web. La release iOS della versione gratis
   e un lavoro a parte: Apple impone l'acquisto in-app per gli abbonamenti digitali, che
   e una integrazione diversa da Stripe, con un suo server di verifica. Ordine consigliato:
   web prima, App Store dopo, e la prima release sullo Store solo-gratis-solo-locale.
3. **Analisi dei pattern** (M4). Non e in questa spec. Le statistiche non-AI del mese
   (PR 9) sono deliberatamente il primo passo in quella direzione.
4. **Ricerca full-text.** Su desktop, con la palette Cmd+K, diventa ovvia. In cloud e
   `ilike` su Postgres; in locale va costruita a mano. Non e nelle 11 PR: aggiungerla
   quando il resto sta in piedi.
5. **Font della colonna di scrittura** (§5.3). Con i temi la domanda cambia forma: non e
   piu "quale font", e "il ruolo `prose` del tema vale anche per l'editor?". Se si, ogni
   tema decide da solo e la deroga al brandbook sparisce come problema — diventa una scelta
   del tema `wine`. Raccomandazione: si. Serve prima della PR 7.
6. **Capitolo 20 del brandbook: focus e hover.** Il brandbook non ha un capitolo desktop.
   Oggi l'unico `:hover` in tutto il repo e `mese.html:250`, e non esiste nessuno stato
   `:focus-visible`. Una superficie che si guida con ⌘K, ⌘S, ⌘⏎ e Esc senza focus ring e
   inutilizzabile da tastiera. Proposta di partenza, coerente col focus glow ambra del
   cap. 09: `box-shadow: 0 0 0 2px rgba(227,161,95,.45)`. Va scritto nel brandbook prima
   della PR 6, non deciso a caso dentro un componente.
7. **Recap: tab o dentro Altro?** Nei mockup approvati Recap vive **dentro** Altro
   (card editoriale in cima). La rail desktop lo promuove a voce di primo livello. E una
   divergenza reale, non un dettaglio: va decisa. Stessa cosa per l'etichetta, "Ricorda"
   (rail nuova) contro "Remember" (cap. 11 del brandbook e `today.html`).
8. **Privacy policy e termini.** Servono anche per la sola versione gratis, e devono
   esistere prima di qualsiasi distribuzione pubblica. Per la versione premium il
   discorso e piu serio: un diario contiene dati che il GDPR tratta come particolari
   (art. 9), e il testo passa da un fornitore terzo. Finche il premium e un utente solo
   la questione e teorica; nel momento in cui si vende ad altri non lo e piu.
