# Referto: la mappa del codice per costruire l'ospite (pezzo 3 della SPEC)

Scritto il 3 settembre 2026 da una sessione di lettura (nessuna modifica), su main dopo la
cassaforte (PR 51). Serve a chi costruisce R1-R4 di SPEC-ospite-e-cassaforte.md per non
rifare la ricognizione. Righe e numeri di riga erano giusti a quel commit: verificali.


**Nota preliminare importante:** la spec di questo lavoro **esiste già** ed è `/tmp/jm-work/SPEC-ospite-e-cassaforte.md` (434 righe, decisa il 3 settembre 2026). Il pezzo che devi costruire è il **punto 3 dell'ordine dei lavori** (righe 390-408): "L'ospite e la quota (R1, R2, R3, R4)". I requisiti sono R1 (righe 50-59), R2 (61-74), R3 (76-85), R4 (87-94), più il **cambio di contratto della sezione 5** (righe 268-288) e il perimetro dei permessi (sezione 8, righe 369-386: ospite/quota/primo avvio → modulo `accesso`; quota/muro/premium → `abbonamento`; tetto di spesa → `admin`; scheletro solo con sessione dichiarata, ok di Manuel già dato). Le **4 decisioni ancora di Manuel** (sezione 7, righe 354-366) includono proprio "quanto è grande il regalo" e "il tetto di spesa mensile": la spec dice esplicitamente di costruire il meccanismo **configurabile** e chiedere.

---

## 1. PRIMO AVVIO oggi — cosa vede esattamente un utente nuovo

### I pezzi

**`src/lib/data/store/index.ts`** (134 righe) — la risoluzione della modalità:
- `LOCAL_MODE_KEY = "jm.mode"` (riga 29), valore `"local"`.
- `ResolvedMode = "resolving" | "local" | "cloud" | "none"` (riga 27).
- `resolveStorageMode()` (righe 49-72), **una volta per sessione**, memoizzata in `resolved`/`resolving`: (1) se `localStorage["jm.mode"] === "local"` → `local` **sincrono, prima di tutto** (righe 53-60); (2) altrimenti import dinamico di `@/lib/supabase/client` e `getAccessToken()` → `cloud` (righe 62-65); (3) altrimenti `none` (riga 69).
- `chooseLocalMode()` (righe 78-86): scrive il flag, azzera `resolving`, `settle("local")`. Non tocca Supabase.
- `clearLocalMode()` (righe 89-98): rimuove il flag, rimette `resolved = "resolving"` e **rilancia** `resolveStorageMode()`.
- `useStorageMode()` (righe 100-107): `useSyncExternalStore`, server snapshot `"resolving"`.
- `getStore()` (righe 119-126): `LocalStore` solo se `resolved === "local"`, altrimenti `CloudStore` (anche con `"none"`/`"resolving"` — commento righe 114-118).

**`src/components/auth-gate.tsx`** (188 righe) — il gate a tre esiti:
- `isPublicPath()` (righe 22-32): `/login`, `/auth`, `/app/benvenuto`, `/privacy`, `/termini`.
- Righe 61-92: **il client Supabase non viene costruito affatto se `mode === "local"`** (`if (mode === "resolving" || mode === "local") return;`). È la riga che tiene in piedi la promessa zero-rete.
- Riga 95: `entered = mode === "local" || auth === "in"`.
- Righe 100-113: in locale `segnaModalitaLocale()`; in cloud `risolviCassaforte(userId)`.
- Riga 114: `settledOut = mode !== "resolving" && mode !== "local" && auth === "out"`.
- **Righe 124-127: `if (settledOut && !publicPath) router.replace("/login")`** ← questa è la riga che oggi viola R1. Il commento (righe 125-132) dice: "Dal 24 agosto 2026 la prima schermata è il LOGIN, non più il bivio (deciso da Manuel)".
- Righe 133-140: chi ha sessione e sta su `/login` → `/app`. In locale `/login` resta raggiungibile di proposito (righe 137-139).
- Righe 145-147: `if (mode === "resolving") return null` — niente flash, la splash resta.
- Righe 149-181: in cloud, prima di entrare, la cassaforte: `risolvendo` → null, `errore` → schermata "La cassaforte non risponde" con Riprova, `cancello` → `<CassaforteCancello>`.

**`src/app/(app)/layout.tsx`** (65 righe) — l'ordine di montaggio: `Toaster` → `PremiumWelcome` → `Splash` → `Linguetta` → `BiometricLock` → **`AuthGate`** → `SalutoAvvio` (riga 59) → `DesktopShell` → children.

**`src/app/(app)/login/page.tsx`** (456 righe):
- **La riga "Tienilo solo su questo dispositivo": righe 439-445**, `<Button variant="ghost" onClick={() => void startLocal()}>`, sotto un separatore "oppure" (righe 420-438).
- `startLocal()` (righe 133-143): `chooseLocalMode()` → `getStore()` → se `LocalStore`: `requestPersistence()` (dopo il gesto, SPEC-v2 §2.5) + `setMeta("onboardingDone", true)` → `router.replace("/app")`.
- Sotto, righe 446-450: "Il codice vale un'ora." / "La versione gratis non ha bisogno di email: resta tutto qui."
- `afterLogin()` (righe 116-123): `clearLocalMode()` poi `registraAccesso() ? "/app/benvenuto" : "/app"`.
- Fasi: email → codice 6 cifre (`verifyOtp`) → `dopoCodice()` → eventuale proposta Face ID (righe 88-114) → `afterLogin()`.
- Porta revisore Apple: `POST /api/review-login` prima dell'OTP (righe 160-181, 204-230).

**`src/app/(app)/app/benvenuto/` — solo due file:** `CLAUDE.md` e `page.tsx` (263 righe). **Non ci sono componenti**: è una pagina sola. Punti chiave:
- `postLogin = mode === "cloud"` (riga 38), `waiting = mode === "resolving"` (riga 42), `native = isNative()` (riga 48).
- Righe 60-68: con `usePianoNoto() === "premium"` entra da sola (senza l'ottimismo di `usePlan`).
- `startLocal()` righe 94-106 (identica a quella del login).
- Card gratis (126-151): tag "Gratis, per sempre", titolo "Solo su questo dispositivo", tre `<li className="no">`: "Niente racconto a voce", "Niente titoli, sintesi e recap AI", "Un dispositivo solo".
- Card premium (153-213): su `native` bottone "inizia premium" → `startPremiumV1()`; su web "prova premium" → `openPremiumWall("aiSummary")` (riga 206).
- Piede righe 248-260: pre-login "Nella versione gratis nessun dato lascia il dispositivo: non c'è un server a cui mandarli."

### Passo per passo, un utente nuovo oggi (installazione pulita)

1. `Splash` copre lo schermo. `AuthGate` rende `null` (`mode === "resolving"`).
2. `resolveStorageMode()`: nessun `jm.mode`, nessun token → **`none`**.
3. `auth` passa a `"out"` → `settledOut = true`, `/app` non è pubblico → **`router.replace("/login")`**.
4. **Vede la schermata di login**: marchio, titolo "Benvenuto" (riga 388, `isReturning` false), "Inserisci la tua email. Ti mando un codice di sei cifre, niente password.", campo email, bottone "Mandami il codice", separatore "oppure", bottone fantasma **"Tienilo solo su questo dispositivo"**, e la nota finale in due righe.
5a. Se toccasse la riga fantasma: `chooseLocalMode()` → persistenza → `/app`, e da lì `SalutoAvvio` (il messaggio di benvenuto della migration 018, velo bloccante). Modalità locale, AI tutta spenta.
5b. Se mette l'email: codice → eventuale Face ID → `afterLogin()` → `/app/benvenuto` (prima volta su questo dispositivo, `welcomeSeen()` false) → il bivio "Dove vuoi tenere il tuo diario?" → `/app`.

**Quindi: R1 è violato in due punti.** Il costo attuale fra apertura e primo carattere è **almeno 4-6 tocchi** (email, invio, 6 cifre, entra, poi il bivio, poi il velo del saluto). Il minimo intervento per R1 è: in `auth-gate.tsx` righe 124-127 sostituire il rimbalzo a `/login` con `chooseLocalMode()` (o un terzo esito "ospite"), e togliere `registraAccesso() → "/app/benvenuto"` dal primo avvio. `/benvenuto` non va cancellata: la spec R1 riga 56 dice che la scelta "continua a esistere come voce in Impostazioni".

---

## 2. CAPABILITIES e MURO

### `src/lib/capabilities.ts` (39 righe)
- `Capability = "voice" | "aiSummary" | "recap" | "patterns" | "sync"` (riga 19).
- `can(c)` righe 21-25: **`if (getStore().mode !== "cloud") return false;`** poi `sync` sempre true, il resto `getPlanSync() === "premium"`.
- `useCan(c)` righe 31-39: `if (mode === "local") return false;` poi `sync` true, resto `plan === "premium"`.
- Il commento in testa (righe 6-9) è il contratto: "Non deve mai esistere una schermata in cui il client crede di poter chiamare un endpoint e si becca un 402 a sorpresa."

**Per l'ospite queste due funzioni sono il punto di rottura**: entrambe restituiscono `false` in locale per costruzione. L'ospite ha i dati in locale **e** l'AI accesa: serve un terzo stato (es. quota residua > 0) invece di un booleano derivato dalla modalità.

### `src/lib/plan.ts` (160 righe)
- `KEY = "jm.plan"`, cache sincrona in localStorage.
- `getPlanSync()` righe 121-125: **ottimista, `?? "premium"`** finché non si sa.
- `usePianoNoto()` righe 136-149: `Plan | null`, senza ottimismo.
- `refreshPlan()` righe 91-115: **`if (mode !== "cloud") return;`** — mai in locale.
- `setPlanNow`, `forcePlanRefresh`, `clearPlanCache` (62-89).

### `src/modules/abbonamento/components/premium-wall.tsx` (238 righe)
**Firme:**
```ts
export type WallFeature = "voice" | "aiSummary" | "recap" | "patterns";   // riga 29
export function openPremiumWall(feature: WallFeature, onDismiss?: () => void): void  // righe 43-49
export function closePremiumWall(): void   // righe 51-54
export function PremiumWall()              // riga 99
```
Store di modulo (`state` riga 37 + `listeners`), letto con `useSyncExternalStore` (56-65). Montato **una volta sola** in `src/components/desktop/desktop-shell.tsx:63`.

**Testi:** `TITLES` righe 73-78 (con `\n` dentro la stringa perché la traduzione decida dove spezzare — `.jm-wall-t` ha `white-space: pre-line`):
- `voice`: "Per raccontare a voce\nserve premium"
- `aiSummary`: "Per il titolo e la sintesi\nserve premium"
- `recap`: "Per i recap del mese\nserve premium"
- `patterns`: "Per le letture sui pattern\nserve premium"

`FEATURES` righe 80-97: quattro voci ("Racconti e basta", "Titolo, sintesi, macro-aree", "Recap e pattern", "Su tutti i dispositivi"). Corpo fisso righe 181-183: *"La trascrizione e la rielaborazione girano su un server e costano a ogni minuto registrato. Per questo non posso regalarle: le paghi tu o le pago io."* ← **questa frase va riscritta per l'ospite**, che riceve esattamente un regalo.

**Varianti / cosa fa "prova premium":** `tryPremium()` righe 129-168:
- `mode === "local"` → chiude il muro e `router.push("/login")` (righe 130-138). **In locale premium = farsi un account.**
- `fakeCheckoutEnabled()` → `/app/checkout-finto` (143-148).
- altrimenti `POST /api/stripe/checkout`, e se non c'è `url` → `setCloudNote(true)` (149-167).

**Rendering condizionale** righe 199-231: se `cloudNote || isNative()` compare la nota "L'abbonamento si attiva a breve...". Se `isNative()`: **nessun bottone d'acquisto**, solo — e solo in locale — "Ho già un account" → `/login` (206-219). Fuori dal guscio: `"prova premium" . PREMIUM_PRICE_LABEL`. Sempre in fondo: `"non ora"` → `dismiss()` che chiama `state?.onDismiss` (righe 107-112). Esc = uscita gratuita (115-125). Scrim cliccabile (righe 171-177).

### `src/lib/pricing.ts` (45 righe)
- `PREMIUM_PRICE_AMOUNT = "4,99 €"` (10), `PREMIUM_PRICE_PERIOD = "al mese"` (13), `PREMIUM_PRICE_LABEL` (16).
- `PREMIUM_HAS_FREE_TRIAL = false` (27) — con il commento (18-26) su perché: "finché questa costante è false, nessuna schermata può promettere un mese gratis (lo faceva /benvenuto, ed era una bugia)".
- **`PREMIUM_IOS_V1_GRATIS = true`** (45), commento righe 29-44: su iOS il premium si attiva **davvero e gratis** via `/api/premium-v1` con `plan_source = 'ios-v1'`; l'upgrade a IAP passa da questa costante sola.

### TUTTI i call-site

**`openPremiumWall` (10 chiamate reali + 1 riga di ri-export):**
| File | Riga | Argomenti |
|---|---|---|
| `src/lib/api.ts` | 84 | `("aiSummary")` — **automatica su HTTP 402** |
| `src/components/ui/account-menu.tsx` | 170 | `("aiSummary")` (voce "Passa a Premium"/"Scopri Premium") |
| `src/app/(app)/app/benvenuto/page.tsx` | 206 | `("aiSummary")` (card Premium, web, post-login) |
| `src/modules/oggi/components/today-client.tsx` | 257 | `("voice", () => setView("manual"))` — arrivo con `?record=1` |
| `src/modules/oggi/components/today-client.tsx` | 381 | `("voice", () => setView("manual"))` — `handleStartRecording` |
| `src/modules/oggi/components/today-client.tsx` | 1034 | `("aiSummary")` — prop `onSeePremium` della vista gratis |
| `src/modules/recap/components/recap-client.tsx` | 59 | `("recap")` |
| `src/modules/ricorda/components/quick-capture.tsx` | 101 | `("voice")` (senza uscita contestuale) |
| `src/modules/impostazioni/components/settings-client.tsx` | 781 | `("aiSummary")` — bottone rail destra "Passa a Premium" |
| `src/modules/impostazioni/components/settings-client.tsx` | 843 | `("aiSummary")` — `PremiumInvite` (telefono) |

Nessun call-site usa mai `"patterns"`: il muro `patterns` esiste nei `TITLES` ma non è raggiungibile (il Mese mostra solo una pill, vedi sotto).

**`can(...)` / `useCan(...)` (13 call-site):**
| File | Riga | Chiamata |
|---|---|---|
| `src/modules/oggi/components/today-client.tsx` | 152, 153 | `useCan("voice")`, `useCan("aiSummary")` |
| `src/modules/oggi/components/add-to-day.tsx` | 86 | `useCan("voice")` |
| `src/modules/oggi/components/day-client.tsx` | 90, 91 | `useCan("aiSummary")`, `useCan("voice")` |
| `src/modules/recap/components/recap-client.tsx` | 29 | `useCan("recap")` |
| `src/modules/mese/components/mese-grid.tsx` | 135 | `useCan("patterns")` |
| `src/modules/ricorda/components/quick-capture.tsx` | 33 | `useCan("voice")` |
| `src/modules/ricorda/components/remember-client.tsx` | 57 | `can("aiSummary")` (in `if (kind === "nota" && ...)`) |
| `src/lib/actions/generate-recap.ts` | 41 | `if (!can("recap"))` |
| `src/lib/actions/save-recording.ts` | 106, 207 | `can("aiSummary") && !input.skipAI`; `can("aiSummary")` |

Nessun call-site di `can("sync")`/`useCan("sync")`.

---

## 3. SERVER

### `src/lib/server/entitlement.ts` (164 righe)

```ts
export function getAdminClient(): SupabaseClient | null                                  // 38-43
export async function requireUser(req: NextRequest):
  Promise<{ userId: string; email: string | null } | NextResponse>                        // 53-84
export async function requirePremium(req: NextRequest):
  Promise<{ userId: string } | NextResponse>                                             // 100-133
export async function requireAdmin(req: NextRequest):
  Promise<{ userId: string; email: string } | NextResponse>                              // 154-164
```

**Come leggono il bearer** — un punto solo, `requireUser` righe 64-81:
```ts
const header = req.headers.get("authorization") ?? "";
const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
if (!token) → 401 "Missing bearer token"
const { data, error } = await supabase.auth.getUser(token);   // service role
if (error || !data.user) → 401 "Invalid or expired token"
return { userId: data.user.id, email: data.user.email ?? null };
```
`requirePremium` chiama `requireUser`, poi legge `profiles.plan` col service role (114-118); errore di lettura → **500** con `Cannot read profile: ...` (commento: "Most likely: migration 006 not applied yet. Surface it as a server problem, not as 'you are not premium'"); `plan !== 'premium'` → **402 `{ error: "Premium required" }`** (128-130).

`getAdminClient` (38-43): legge `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, singleton `admin` (25-31) con `{ auth: { persistSession: false, autoRefreshToken: false } }`. Ritorna `null` se le env mancano.

`requireAdmin` (154-164): `requireUser`, poi `email.trim().toLowerCase() !== ADMIN_EMAIL` → **404, non 403** ("la rotta non deve nemmeno confermare di esistere", righe 146-152). `ADMIN_EMAIL = "madh52@gmail.com"` **riga 144**, con il commento (135-143) che spiega perché sta nello scheletro e non in un modulo.

**Nota per l'ospite:** tutte e tre le guardie partono da `supabase.auth.getUser(token)`. Un ospite non ha token. Serve una **quarta guardia** (es. `requireOspiteOPremium`) che accetti l'alternativa "braccialetto anonimo" — oppure si passa da `signInAnonymously` di Supabase (vedi §8).

### `src/lib/server/ai-usage.ts` (92 righe)

```ts
export type AiRoute = "transcribe" | "process-entry" | "split-by-date" | "extract-people"
  | "extract-facts" | "chiarimenti" | "classify" | "recap";                        // 18-27
export const MODEL_PRICES_USD: Record<string, {input:number; output:number}>       // 30-44
export function estimateUsd(model, inputTokens, outputTokens): number              // 46-54
export type ChatUsage = { prompt_tokens?, completion_tokens? }                     // 57-60
export type TranscribeUsage = { type?, input_tokens?, output_tokens?, seconds? }   // 63-68
export async function logAiUsage(entry: { userId; route; model;
  inputTokens?; outputTokens?; audioSeconds? }): Promise<void>                     // 70-92
```

**Colonne scritte** (righe 81-88): `user_id`, `route`, `model`, `input_tokens` (`Math.max(0, Math.round(... ?? 0))`), `output_tokens` (idem), `audio_seconds` (`?? null`). Tutto dentro `try/catch` vuoto: "Mai far fallire la risposta per un log" (riga 90). Se `getAdminClient()` è null, ritorna in silenzio (riga 80).

**Come si stima il costo USD** (righe 46-54): `(inputTokens * p.input + outputTokens * p.output) / 1_000_000`, con `p = MODEL_PRICES_USD[model]` e **`if (!p) return 0`** — un modello non in tabella costa zero. Prezzi (USD per 1M token, istantanea agosto 2026): `gpt-4o-mini` 0.15/0.6, `gpt-5.6-luna` 0.2/1.2, `gpt-5.6-terra` 2/12, `gpt-4.1-mini` 0.4/1.6, `gpt-5-mini` 0.25/2, `gpt-4o` 2.5/10, `gpt-4o-transcribe` 6/10 (commento riga 42: "input = token AUDIO, circa 1 minuto ~ 600 token, ~0,006 $/min").

**La stima NON è persistita**: `ai_usage` non ha colonna costo, `estimateUsd` gira solo a lettura. Per il tetto globale di R4 va sommato a query-time, o si aggiunge una colonna/vista.

### `src/lib/api.ts` (91 righe) — `apiFetch`

```ts
export type ApiFetchInit = RequestInit & { timeoutMs?: number };                   // 29
export async function apiFetch(path, init: ApiFetchInit = {}): Promise<Response>   // 54-91
export function apiUrl(path: string): string                                       // 18-20
const DEFAULT_TIMEOUT_MS = 15_000;                                                 // 27
const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");         // 16
```
**Header iniettati** (righe 60-73):
- `Authorization: Bearer <access_token>` — solo `if (token)` (riga 72), da `conSegnale(getAccessToken(), ctrl.signal, "gettone di accesso")`.
- `x-jm-lang: getLang()` — **sempre** (riga 73).

Il cronometro (`setTimeout` + `AbortController`, righe 61-62) **parte prima del recupero del gettone** — è la correzione di R11 (commento righe 41-46). Righe 80-86: **unica interpretazione di status code**, `402` → import dinamico del muro e `openPremiumWall("aiSummary")`; la Response viene comunque restituita così i chiamanti fanno il fallback. Riga 48: "No fetch("/api/...") may exist outside this helper."

### Le 7 route AI: guardia + argomenti a `logAiUsage`

| Route (`src/app/api/...`) | Implementazione | Guardia | riga | `logAiUsage` | riga |
|---|---|---|---|---|---|
| `chiarimenti` | `src/modules/oggi/server/chiarimenti.ts` | `requirePremium` | 137 | `{ userId, route:"chiarimenti", model, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens }` | 320-326 |
| `extract-facts` | `src/modules/oggi/server/extract-facts.ts` | `requirePremium` | 75 | `{ userId, route:"extract-facts", model, prompt_tokens, completion_tokens }` | 187-193 |
| `process-entry` | `src/modules/oggi/server/process-entry.ts` | `requirePremium` | 84 | `{ userId, route:"process-entry", model:"gpt-4o-mini", ... }` — **model letterale** | 253-259 |
| `split-by-date` | `src/modules/oggi/server/split-by-date.ts` | `requirePremium` | 19 | `{ userId: gate.userId, route:"split-by-date", model:"gpt-4o-mini", ... }` | 147-153 |
| `transcribe-fallback` | `src/modules/oggi/server/transcribe-fallback.ts` | `requirePremium` **su GET (29) e su POST (50)** | 29, 50 | `{ userId: gate.userId, route:"transcribe", model:"gpt-4o-transcribe", inputTokens: data?.usage?.input_tokens, outputTokens: data?.usage?.output_tokens, audioSeconds: typeof data?.usage?.seconds === "number" ? ... : undefined }` | 118-126 |
| `recap/generate` | `src/modules/recap/server/generate.ts` | `requirePremium` | 15 | `{ userId: gate.userId, route:"recap", model:"gpt-4o", ... }` | 145-151 |
| `remember/classify` | `src/modules/ricorda/server/classify.ts` | `requirePremium` | 19 | `{ userId: gate.userId, route:"classify", model:"gpt-4o-mini", ... }` | 109-115 |

Osservazioni:
- **Tutte e 7 usano `requirePremium`, nessuna `requireUser`.** L'ospite prende 402 su ognuna.
- Due stili di `userId`: `const { userId } = gate` (chiarimenti 139, extract-facts 77, process-entry 86) vs `gate.userId` inline. Il tipo di `requirePremium` è `{ userId: string }`: se l'ospite non ha `userId`, **il tipo di ritorno delle guardie va allargato** e questi 7 punti di `logAiUsage` vanno toccati tutti (il `user_id` di `ai_usage` è `uuid not null references auth.users(id)` — vedi §4: **un ospite senza riga in `auth.users` non può essere loggato lì così com'è**).
- `chiarimenti` e `extract-facts` accettano `body.model` **solo se `fakeCheckoutEnabled()`** (chiarimenti 175-178, extract-facts 99-102) — e quel modello finisce dentro `logAiUsage`.
- `chiarimenti` non fallisce mai con errore (commento righe 141-147): risponde `{ domande: [], errore }`.
- `transcribe-fallback` GET è un warm-up gated (commento righe 18-27): "A 401/402 still warms the lambda, so the client fires it regardless of plan."
- `AiRoute` include `"extract-people"` ma **non esiste una route con quel nome** in `src/app/api/`: valore morto.
- Il `logAiUsage` di `transcribe` è l'unico che passa `audioSeconds`, ed è il 90% del costo per persona secondo la spec (riga 361).

Route non-AI e loro guardie, per completezza: `stripe/checkout` → `requireUser` (`stripe-checkout.ts:16`), `premium-v1` → `requireUser` (`premium-v1.ts:30`), `dev-checkout` → `requireUser` (36), `account/{avatar,nome,delete}` → `requireUser`, `usage` → `requireUser` (`usage.ts:12`), `admin/aree` → `requireAdmin` (60, 82), `admin/benvenuto` → `requireAdmin` (76, 104), `sito/seo` → `requireAdmin` (59, 81), `sito/supporto` → `requireAdmin` (146).

---

## 4. TABELLE

### `supabase/migrations/009_ai_usage.sql` (25 righe)
```sql
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  audio_seconds numeric,
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
create policy "read own ai usage" on public.ai_usage for select using (auth.uid() = user_id);
create index if not exists ai_usage_user_created on public.ai_usage (user_id, created_at desc);
```
RLS: **solo select "propria"**, nessuna policy di insert/update/delete → scrive solo il service role (commento righe 3-4). Un indice solo, `(user_id, created_at desc)`.

**Due vincoli che l'ospite rompe:** `user_id` è `not null references auth.users(id)`; e non esiste indice su `created_at` da solo, quindi la somma globale per il tetto di R4 farebbe **seq scan** (con l'aumento del volume che l'ospite porta, va aggiunto `(created_at)` o una tabella/vista di aggregato).

### `supabase/migrations/010_plan_limits.sql` (21 righe)
```sql
create table if not exists public.plan_limits (
  tier text primary key,
  monthly_allowance_usd numeric not null default 0
);
insert into public.plan_limits (tier, monthly_allowance_usd)
values ('free', 0), ('premium', 2.00) on conflict (tier) do nothing;
alter table public.plan_limits enable row level security;
create policy "read plan limits" on public.plan_limits for select using (true);
```
Nessun indice oltre la PK. **Lettura pubblica**, nessuna policy di scrittura. Commento riga 3: "La modificherà la pagina admin (solo master, in arrivo) via service role" — **quella pagina non è mai stata fatta**: nel pannello "Piani e limiti" è uno `<span className="jm-adm-nav-off">` spento (`admin-client.tsx:110`).

Questa tabella è il candidato naturale per la quota dell'ospite (`values ('ospite', ...)`) e per il tetto globale di R4 — ma `monthly_allowance_usd` è **per-tier per-utente**, non un totale globale: serve una riga/tabella diversa (es. `tetto_globale_usd`).

C'è anche un `010_default_goals.sql`: **due migration con il prefisso 010**. Vale la pena saperlo prima di numerare la prossima.

### `supabase/migrations/006_profiles.sql` (51 righe)
```sql
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  plan_source text,                        -- 'stripe' | 'manual' | 'apple'
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = user_id);
```
Nessun indice oltre la PK. Nessuna policy di insert/update (riga 21). Poi:
- `seed_profile()` `security definer` (29-40) + trigger `seed_profile_on_user_create` `after insert on auth.users` (42-44) → **ogni utente nuovo nasce `free` da solo**;
- backfill finale (49-51) "so requirePremium never has to special-case a missing profile".

Il `check (plan in ('free','premium'))` è un vincolo da valutare: una terza condizione "ospite" (spec §2, tabella righe 34-38) non passa. Se l'ospite diventa un utente Supabase anonimo, il trigger gli dà già `free` — e `free` significa AI spenta.

Migration più recenti utili al contesto: `008_profiles_stripe.sql`, `016_profile_avatar.sql`, `017_profile_name.sql`, `020_foto.sql`, **`021_cassaforte.sql`** e **`022_buste.sql`** (le due che la spec R6 dice "in attesa in produzione", riga 107).

### `/api/usage` — `src/modules/impostazioni/server/usage.ts` (114 righe)

**Come calcola il mese** — righe 23-26:
```ts
const now = new Date();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
```
Cioè: **primo giorno del mese corrente a mezzanotte UTC**, e poi `.gte("created_at", monthStart)` (riga 33). Nessun limite superiore (il futuro non esiste). Mese solare UTC, non finestra rolling e non ancorato alla data di abbonamento — da tenere presente se la quota dell'ospite deve essere **a vita** e non mensile (R2 riga 74: "un ospite consuma la quota, l'app viene disinstallata e reinstallata, la quota resta consumata" — cioè non si azzera nemmeno a inizio mese; il conteggio dell'ospite è **cumulativo**, quindi non riusa questa logica).

Il resto: `requireUser` (12), due query in `Promise.all` su `ai_usage` (select `route, model, input_tokens, output_tokens, audio_seconds`) e `profiles.plan` (28-39); `plan_limits` in una terza query dentro `try/catch`, `allowanceUsd = null` se manca (45-61); aggregazione per route in `byRoute` con `Agg = { calls, inputTokens, outputTokens, audioSeconds, estUsd }` (63-92); `roundedUsd = Math.round(totalUsd * 10_000) / 10_000` (99); `pct = Math.min(999, Math.round(roundedUsd / allowanceUsd * 100))` o `null` (100-103). Risposta: `{ monthStart, plan, byRoute, totalTokens, totalUsd, allowanceUsd, pct }`.

Lato client: `src/lib/data/usage.ts` (tipi) e `src/modules/impostazioni/components/consumi-panel.tsx` (la barra; riga 255 commenta "senza tetto una barra sarebbe una..."). Banco: `scripts/verify-consumi.mjs` (righe 158-165: in locale, **zero richieste esterne** e nessuna `/api/usage`).

---

## 5. ADMIN

### Com'è fatto il pannello

Tre file di codice + due server + CSS:
- **`src/app/(app)/admin/page.tsx`** (10 righe): guscio, `<AdminClient />`.
- **`src/modules/admin/components/admin-client.tsx`** (137 righe): guardia + rail + voce scelta. `Voce = "aree" | "sito" | "benvenuto"` (riga 36), `Stato = "carico" | "negato" | "pronto"` (35).
- **`src/modules/admin/components/aree-schermata.tsx`**, **`benvenuto-schermata.tsx`**: una voce = un file.
- **`src/modules/admin/server/aree.ts`**, **`server/benvenuto.ts`**: le rotte (i gusci sono `src/app/api/admin/aree/route.ts` e `.../benvenuto/route.ts`).
- **`src/modules/admin/index.ts`** (8 righe): `export {}` — **vuota di proposito**. "Il pannello di controllo non presta niente a nessuno — è la direzione giusta della dipendenza."
- `src/modules/admin/en.ts`, `src/modules/admin/styles.css` (prefisso `jm-adm`), `CLAUDE.md` (31 righe).

### Come verifica il "master" (chi è master)

**Doppia guardia, e quella vera è sul server.**
1. **Client** (`admin-client.tsx`): `negatoSenzaCloud = mode !== "resolving" && mode !== "cloud"` (riga 49) → in locale non parte **nessuna** richiesta. Poi `GET /api/admin/aree` (61): `!resp.ok` → `stato = "negato"`. Riga 87: **`if (negatoSenzaCloud || stato !== "pronto") return null;`** — chi non è admin vede **niente**, nemmeno mentre carica (commento 85-86: "comparire e poi sparire direbbe comunque che qui c'era qualcosa"). Il commento 19-22 spiega che le aree si caricano sempre **perché quella lettura È la guardia**.
2. **Server**: `requireAdmin` in `src/lib/server/entitlement.ts:154-164` → confronto `email.trim().toLowerCase() !== ADMIN_EMAIL` con `ADMIN_EMAIL = "madh52@gmail.com"` (riga 144), risposta **404**. Un unico posto, per la ragione scritta alle righe 135-143 (prima stava dentro `src/modules/admin/server.ts`, poi il pannello ha preso una voce dal modulo `sito`).

L'email è anche **stampata a schermo** in `admin-client.tsx:113`: `<b>madh52@gmail.com</b>` + "l'unico che entra qui" (hardcoded nel JSX, non importata dalla costante server).

Il `CLAUDE.md` (righe 6-11) cita ancora `server.ts` come sede del controllo: **è disallineato**, il file non esiste più.

### Come si aggiunge una voce

Il pattern è esplicito nel commento di `admin-client.tsx` righe 14-17: *"QUI STA SOLO IL GUSCIO: la guardia, la rail e la voce scelta. Ogni voce è un file suo, e non tutte di questo modulo — il Sito arriva dalla porta di `sito`."*

I passi, dedotti dalle tre voci esistenti:
1. **La tabella**: una migration con lettura pubblica (`for select using (true)`) e **nessuna policy di scrittura**.
2. **La rotta**: `src/modules/<modulo>/server/<voce>.ts` con `requireAdmin` in testa a ogni handler + `getAdminClient()`; guscio in `src/app/api/admin/<voce>/route.ts` (o `src/app/api/<modulo>/<voce>/` come fa `sito/seo`).
3. **La schermata**: un componente in `components/`, che rende `<main className="jm-adm-main">` con `jm-adm-bar` / `jm-adm-h1` / `jm-adm-sub` (il modello è il blocco `sito`, `admin-client.tsx:120-134`).
4. **Il guscio**: aggiungere il valore al type `Voce` (riga 36), un `<button className={vai("<voce>")}>` nella `<nav>` (99-111) e una riga `{voce === "<voce>" && <...Schermata />}` (118-134).
5. Se la voce vive in un altro modulo, esce dalla **porta** di quel modulo (`import { PannelloSeo } from "@/modules/sito"`, riga 31) — mai `@/modules/sito/components/...`: il lint dei confini è a ERRORE.
6. Traduzioni in `src/modules/admin/en.ts`, CSS col prefisso `jm-adm`.
7. Banchi: `verify-aree` + `verify-i18n` (`CLAUDE.md` riga 31), più `verify-benvenuto` sezione 8.

Le tre voci **spente** (span, non button) sono i segnaposto già previsti: `"Obiettivi di default"` (108), `"Modelli AI"` (109), **`"Piani e limiti"` (110)** ← il tetto di spesa di R4 va lì.

### Le tabelle `aree` (015) e `benvenuto` (018)

**`015_aree.sql`** (81 righe): `aree(chiave text primary key, nome, nome_en, cosa_ci_va text default '', ordine integer not null, icona text, attiva boolean default true, created_at, updated_at)`. Indice `aree_ordine_idx on (ordine)` (48). RLS on; **`"aree: lettura pubblica" for select using (true)`** (55-56); nessuna policy di scrittura (58-60). Seed di 6 aree (62-81). Il commento più importante (righe 9-19): la differenza fra `chiave` (opaca, immutabile, scritta dentro `entries.areas`) e `nome` (visibile, rinominabile). Righe 21-23: `cosa_ci_va` **finisce parola per parola dentro le istruzioni del modello**.

**`018_benvenuto.sql`** (137 righe): `benvenuto(id smallint primary key default 1 check (id = 1), attivo boolean default true, versione integer default 1, + 8 campi testo IT, + 7 campi `_en`, + foto_data / logo_tema_chiaro_data / logo_tema_scuro_data, updated_at)`. Tre `check` di dimensione ≤ 65536 caratteri aggiunti in un blocco `do $$` idempotente (79-94). RLS on; `"benvenuto: lettura pubblica" for select using (true)` (100-102); nessuna scrittura. Seed con le parole del mockup (106-137), `on conflict (id) do nothing`.

Tre idee riusabili da questo schema:
- **`check (id = 1)`** = "questa tabella ha una riga" (commento 11-14) — esattamente la forma che serve al tetto di spesa globale di R4;
- **`versione integer`** come tasto "mostralo di nuovo": alzarlo di uno fa cadere tutti i silenzi in una volta (commento 23-28, e la logica in `server/benvenuto.ts:167-178`, che **legge e incrementa lato server** invece di fidarsi di un numero dal client);
- **`attivo boolean`** = spegni senza svuotare il testo (riga 38-39) — l'interruttore del regalo AI di R4.

### `src/lib/benvenuto-client.ts` (120 righe) — la cache localStorage

`CHIAVE_CACHE = "jm.benvenuto"` (riga 30). Stato di modulo: `corrente` (32, inizializzato a `BENVENUTO_DI_FABBRICA`), `letto` (33), `caricato` (34), `listeners`.
- `dallaCache()` (42-52): **una volta sola, sincrona**, `JSON.parse` + `benvenutoDaRiga`; su errore resta il testo di fabbrica.
- `carica()` (62-84): **fetch REST diretta** su `urlBenvenuto(base)` con header `apikey` + `Authorization: Bearer <anon key>` — non il client Supabase. Su successo: `corrente`, `inCache(riga)`, `emit()`.
- `useBenvenuto()` (90-106): `useSyncExternalStore` dove **`carica()` viene chiamata nel subscribe e solo `if (mode === "cloud")`** (riga 95). Snapshot: `dallaCache(); return corrente;`. Server snapshot: `BENVENUTO_DI_FABBRICA`.
- `contattoUrlNoto()` (117-120): legge la cache **senza far partire nessuna lettura** — con la ragione scritta (108-116): "Una linguetta che accende una richiesta di rete tutta sua romperebbe la regola 1 il giorno che qualcuno la monta su una pagina pubblica."

Le due regole in testa (righe 6-19): (1) in locale non si tocca la rete, (2) il primo render non aspetta nessuno.

### Il pattern per una tabella di configurazione globale letta dal client E dal server

È già codificato tre volte (aree, benvenuto, seo) e va copiato così:

1. **Migration**: tabella con `select using (true)`, **zero** policy di scrittura, valori di seed.
2. **Il contratto nello scheletro** — tre file, e sono la parte che conta:
   - `src/lib/<cosa>.ts`: il **tipo**, i **valori di fabbrica** (`AREE_DI_FABBRICA`, `BENVENUTO_DI_FABBRICA`), il parser `<cosa>DaRiga(riga)` e il costruttore d'URL `url<Cosa>(base)`. Isomorfo, nessun `"use client"`.
   - `src/lib/server/<cosa>.ts`: `leggi<Cosa>()` — fetch REST con la anon key, `cache: "no-store"`, **cache in memoria a scadenza** (`DURATA_CACHE_MS = 60_000`, `aree.ts:22-27`), **fallback ai valori di fabbrica su qualunque errore o su zero righe** (38-50), più `dimentica<Cosa>()` da chiamare quando il pannello scrive (54-56, invocata in `src/modules/admin/server/aree.ts:3`).
   - `src/lib/<cosa>-client.ts`: `use<Cosa>()` con `useSyncExternalStore`, cache localStorage `jm.<cosa>` letta **sincrona** al primo snapshot, fetch **solo `if (mode === "cloud")`** dentro il subscribe.
3. **La rotta admin**: `requireAdmin` + `getAdminClient()` + validazione della forma (`rigaValida`, `aree.ts:41-57`) + invalidazione della cache server.
4. **Il banco**: che in locale non parta nemmeno una richiesta.

**Per il tetto di spesa di R4 questo pattern va però piegato**, perché il tetto è una decisione che il *server* deve prendere **prima** di chiamare OpenAI. La lettura dal client serve solo alla UI (dire "il regalo è finito"). E il valore del contatore consumato **non può** stare in una tabella a lettura pubblica: lì va solo il *limite*, non lo speso.

---

## 6. APP-BAR e ACCOUNT

### `src/components/ui/app-bar.tsx` (242 righe)

La barra **non mostra nessun pallino di stato**: mostra il titolo e monta `<AccountMenu variant="testata" />` (riga 237) come **ultimo elemento a destra, sempre** (commento 123-125: "è ciò che `verify-barra-alto` misura su ogni schermata"). Esiste solo **sotto lg** (commento 15-19; da lg in su il pallino sta in fondo alla rail sinistra e la barra si spegne via `base.css`).

- `titoloSchermata(pathname)` (90-107): normalizza la barra finale (per il guscio iOS con `trailingSlash: true`, commento 91-97), `"/app"` → `"Diario"`, poi la mappa `TITOLI` (74-87): `/app/mese`→Mese, `/app/remember`→Memo, `/app/recap`→Recap, `/app/settings`→Impostazioni, `/app/giorno`→Diario, `/app/persona`→Persona, `/app/palestra`→Palestra. **`null` = niente barra** — ed è l'interruttore delle pagine pubbliche (commento 21-27: login, /benvenuto, /auth, /privacy, checkout, admin non hanno titolo quindi non hanno barra).
- Slot via portal: `AppBarAzione` (`jm-appbar-azione`, 195-197) e `AppBarPrima` (`jm-appbar-prima`, 200-202).
- `useTitoloBarra(titolo, attivo)` (162-174): il nome forzato (per la pagina Record).
- `useContenutoSottoLaBarra()` (47-66): lo scroll in cattura accende `jm-appbar-vetro`.

### `src/components/ui/account-menu.tsx` (348 righe)

**Il "pallino" in locale** — `useAccount()` (60-100):
```ts
const m = await resolveStorageMode();
if (m === "local") { setAccount({ email: null, badge: "Locale" }); return; }   // righe 68-71
```
In cloud: `getUser()` + lettura `profiles.plan`, `badge = "Cloud"` di default e `"Premium"` se il piano lo è (79-88).

Cosa si vede, in locale:
- `locale = mode === "local"` (113); **`mostrato = locale ? t("Questo dispositivo") : nome`** (117); `iniziale = mostrato.slice(0,1).toUpperCase()` → **"Q"**, oppure `"•"` finché `account` è null (121).
- `foto = useProfilo()?.foto ?? null`; `ritratto = foto ? <img> : iniziale` (130-136) — un pezzo solo per tutti e tre i posti.
- Sottotitolo: **`t("Le giornate non escono di qui")`** al posto dell'email (righe 190, 273).
- Nessuna pennina per cambiare nome (`!locale &&`, riga 253).
- **Voci** (`voci()`, 195-226): "Impostazioni" sempre; "Passa a Premium"/"Scopri Premium" **solo `!locale && plan !== "premium"`** (201-206); **"Accedi al tuo account"** → `/login`, **solo in locale**, dopo un separatore (207-215); "Esci dall'account" in rosso, **solo `!locale`** (216-224).

**Il badge "Locale" nella rail-left**: variante `rail` (284-316) — `<div className="jm-rail-avatar">{ritratto}</div>`, `jm-rail-acct-nm` con `mostrato` (o `"…"` se `account` è null, riga 302), e **righe 303-309**:
```tsx
{account && (
  <span className={`jm-rail-pill${account.badge === "Premium" ? " prem" : ""}`}>
    {t(account.badge)}
  </span>
)}
```
Quindi in locale la rail mostra **la pill "Locale"** (senza la classe `prem`), in cloud gratis "Cloud", in cloud premium "Premium" con `.prem`. Il pallino della testata (228-241) invece **non porta nessuna pill**: solo `<i>{ritratto}</i>` in un bottone `jm-hd-av` con `aria-label={t("Il tuo account")}`.

Il commento in testa (righe 18-29) è il contratto delle voci, ed è già scritto per il caso "senza account". **Per l'ospite serve una quarta parola**: l'ospite non è "Locale" nel senso di "ho scelto di stare offline", è "non ho ancora un account" — e la voce da mostrargli è l'invito email di R5, non "Accedi al tuo account".

---

## 7. IMPOSTAZIONI in locale

`src/modules/impostazioni/components/settings-client.tsx` — il ramo `isLocal` compare in due posti (telefono + rail destra) e la logica è simmetrica.

**Telefono, gruppo "Account"** (righe ~587-646 del file, cioè `isLocal ?` a 587):
- `SetRow` **"Dove"** → valore **"Solo su questo dispositivo"** (righe 590-593).
- `SetRow` **"Accedi al tuo account"**, descrizione *"Le giornate che hai già scritto qui salgono nel cloud al primo accesso."*, `onClick={() => router.push("/login")}` (righe 603-609). Il commento sopra (594-602) spiega perché esiste: *"Chi sceglie 'sul telefono' da /benvenuto finiva in un vicolo cieco: in locale non c'è account, non c'è piano, non c'è logout, e da queste impostazioni non esisteva NESSUN modo di accedere. L'unica uscita era premere il microfono e passare dal muro premium — cioè scoprirla per caso. Un revisore Apple che sceglie 'sul telefono' resta chiuso fuori dal proprio account: è un motivo di rifiuto."*
- Poi, comuni a tutti: "Versione" (`APP_VERSION`) e "Pacchetto" (`BUILD_INFO`, `chevron={false}`).
- **Nessun "Esci dall'account"** (`{!isLocal && ...}`, righe 635-644) e **nessun `PremiumInvite`** (riga 585: `{!isLocal && plan !== "premium" && <PremiumInvite />}`).
- **In cloud** invece: `FotoProfiloRow`, "Email", `{isAnonymous && <SetRow title="Account" value="Ospite (cloud)" />}` (righe 621-623), "Piano" (Premium/Gratis), `ConsumiRow` (la barra dei consumi).

**Zona pericolosa:** in cloud "Elimina l'account" (`{!isLocal &&}`, righe 648-672); in locale **"Cancella tutte le giornate"** (`{isLocal &&}`, righe 674-...) — a due tocchi (`eraseArmed`).

**Rail destra** (`RailRight`, righe 703-797):
- `isLocal` → avatar come `<div className="jm-st-av">` muto (713-716) invece di `FotoProfiloRow` (la foto profilo non esiste senza account); nome come `<div className="jm-st-nm">` invece di `NomeRiga`; nessuna email; **`<span className="jm-st-pill">{t("Locale")}</span>`** (riga 731).
- Blocco `jm-st-rr`: in locale la riga **"Dove" / "Solo su questo dispositivo"** (743-748) al posto di "Piano"; **nessun `ConsumiRailRow`** (riga 758: `{!isLocal && ...}`); poi "Versione" e "Pacchetto" per tutti.
- Bottoni in fondo: in locale **`jm-st-out` "Accedi al tuo account"** → `/login` (768-776); in cloud non-premium "Passa a Premium" → `openPremiumWall("aiSummary")` (777-785); in cloud "Esci dall'account" `danger` (786-795).

**Sintesi per l'ospite:** un utente locale oggi vede **tre righe di account** (Dove, Versione, Pacchetto) + una via d'uscita ("Accedi al tuo account", che è la "passa al cloud"), **nessun logout**, **nessuna barra consumi**, **nessun invito premium**, e una zona pericolosa che cancella le giornate. La riga da aggiungere per R1 (spec riga 56: la scelta "dove tenere il diario" continua a esistere come voce in Impostazioni) va in questo gruppo, accanto a "Dove". E la barra dei consumi dell'ospite non può riusare `ConsumiRow`, che passa da `/api/usage` con `requireUser`.

Altro nel file, rilevante: `eseguiLogout` importato da `src/lib/auth/logout.ts` (riga 64) — un punto solo, condiviso con il menu account e con la coda della cancellazione account (righe 291-322). Righe 405-...: "Solo in locale, quando l'ultimo backup è vecchio" — il dovere di ricordare il backup su file.

---

## 8. Dispositivo

### `src/lib/native/platform.ts` (14 righe, tutto)
```ts
import { Capacitor } from "@capacitor/core";
export function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}
```
Un'unica funzione, in `try/catch` perché "lo stesso bundle deve girare anche in una scheda del browser".

### I plugin in `package.json` — **non c'è `@capacitor/device`**

`dependencies`:
- `@aparajita/capacitor-biometric-auth` ^10.0.0
- `@capacitor/app` ^8.1.1
- `@capacitor/core` ^8.5.0
- `@capacitor/filesystem` ^8.1.2
- `@capacitor/ios` ^8.5.0
- `@capacitor/local-notifications` ^8.2.1
- `@capacitor/share` ^8.0.1
- `@supabase/ssr` ^0.10.3, `@supabase/supabase-js` ^2.106.0
- `idb` ^8.0.3, `next` 16.2.6, `react`/`react-dom` 19.2.4, `stripe` ^22.5.0

`devDependencies`: `@capacitor/cli` ^8.5.0, tailwind 4, eslint 9, typescript 5, i `@types/*`.

Plugin nativi scritti in casa (non npm): `ios/App/App/Cassaforte.swift` e `ios/App/App/DockVetro.swift`.

### Come si potrebbe ottenere un id stabile del dispositivo — cosa esiste già

**Non serve `@capacitor/device`**, e anzi il suo `identifier` su iOS è l'IDFV, che cambia quando si disinstallano tutte le app dello stesso vendor — cioè **non soddisfa R2 riga 73** ("Reinstallare l'app non deve regalare una quota nuova").

Il pezzo giusto **esiste già ed è `Cassaforte.swift`**: un item del Keychain con `kSecAttrSynchronizable = true` e `kSecAttrAccessibleAfterFirstUnlock` **sopravvive alla disinstallazione** e viaggia via iCloud fra i dispositivi della stessa persona. È esattamente l'ancoraggio che il "braccialetto anonimo" richiede. Si può:
- riusare il plugin così com'è con un `conto` diverso (l'API prende `conto` come parametro, default `"diario"` — `Cassaforte.swift:46, 65, 86`): es. `conto: "braccialetto"`;
- il lato JS è già astratto in **`src/lib/cassaforte/chiave.ts`** (108 righe): `leggiSeme(conto)` / `scriviSeme(conto, seme)` / `cancellaSeme(conto)` (righe 78-103) che scelgono fra plugin nativo (`nativo()`, 27-31, con `registerPlugin<PluginCassaforte>("Cassaforte")`) e **IndexedDB `journalme-chiave`, store `semi`** sul web (33-75), più `sedeDellaChiave(): "portachiavi" | "browser"` (106-108). Il commento in testa (11-14) dice già la regola: **"Non si tiene mai in localStorage: è leggibile da qualsiasi script della pagina e finisce nei backup in chiaro di Safari."**

Attenzione a due punti se lo si riusa: sul **web** l'ancoraggio è IndexedDB e "chi svuota i dati del sito perde il seme" (righe 9-10) — cioè sul browser R2 riga 73 non è ottenibile con questa strada e va accettato o gestito altrimenti; e la sincronizzazione iCloud significa che **iPhone + iPad della stessa persona condividono un braccialetto solo**, che è probabilmente ciò che si vuole (una quota per persona) ma va deciso.

**Il precedente più vicino nel codice** è `src/modules/accesso/saluto-stato.ts:114-123`:
```ts
function identitaDispositivo(): string {
  const gia = leggi(K_DISPOSITIVO);              // "jm.saluto.dispositivo"
  if (gia) return gia;
  const nuova = `dev:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  scrivi(K_DISPOSITIVO, nuova);
  return nuova;
}
```
Con il commento onesto: *"Nasce alla prima apertura e muore con i dati del sito (cioè con la reinstallazione)."* — cioè **la forma è già quella giusta, ma la sede (localStorage) non regge R2**. Il resto del file è utile come modello: `identita(mode)` (129-144) sceglie fra id di dispositivo (locale) e `session_id` dal payload JWT (cloud, con `payloadJwt` righe 103-112 e il fallback `usr:<id>`), e le righe 12-16 spiegano perché il contatore delle aperture sta sul dispositivo e non sul server ("l'account del revisore Apple è condiviso").

**Terza strada, da valutare:** `settings-client.tsx:621-623` e `src/app/(app)/app/settings/page.tsx:48` (`isAnonymous: !!user && !user.email`) mostrano che il codice **prevede già un utente Supabase senza email** — la riga "Ospite (cloud)". Ma `signInAnonymously` **non è chiamato da nessuna parte** (grep: zero risultati): è un'affordance preparata e mai usata. Se l'ospite diventasse un utente anonimo Supabase, tutta la catena `requireUser`/`logAiUsage`/`profiles`/`ai_usage.user_id` funzionerebbe **senza toccare gli schemi** — al costo che "reinstallo e riparto da zero" tornerebbe possibile (il refresh token sta in localStorage) a meno di ancorare *quel* token nel Keychain. È la combinazione delle due (utente anonimo + refresh token o user id nel Keychain sincronizzato) che soddisfa R2 con il minimo lavoro nuovo sul server.

### `ios/App/App/Cassaforte.swift` (94 righe) — i metodi

Classe `CassafortePlugin: CAPPlugin, CAPBridgedPlugin`, `identifier = "CassafortePlugin"`, **`jsName = "Cassaforte"`**, auto-scoperto come `DockVetro.swift` (riga 21). `servizio = "com.manuelvisuals.dayalogue.cassaforte"` (33).

`base(_ conto:)` (35-42): `kSecClassGenericPassword`, `kSecAttrService = servizio`, `kSecAttrAccount = conto`, **`kSecAttrSynchronizable = kCFBooleanTrue`**.

| Metodo | Firma JS | Righe | Note |
|---|---|---|---|
| `leggi` | `leggi({ conto }) -> { seme: base64 \| null }` | 45-61 | `SecItemCopyMatching`; `errSecItemNotFound` → `{ seme: NSNull() }` (52-55), non un errore; altro stato ≠ success → `reject("keychain: \(stato)")` |
| `scrivi` | `scrivi({ conto, seme: base64 }) -> {}` | 64-82 | `SecItemDelete` **prima** di `SecItemAdd` — commento 71-72: *"SecItemUpdate con la sincronizzazione ha un comportamento diverso fra versioni di iOS"*; imposta `kSecAttrAccessible = kSecAttrAccessibleAfterFirstUnlock` (75) |
| `cancella` | `cancella({ conto }) -> {}` | 85-93 | tollera `errSecItemNotFound` (88) |

Tutti e tre dichiarati in `pluginMethods` con `CAPPluginReturnPromise` (27-31). `conto` ha default `"diario"`. Commenti in testa (5-22): perché `kSecAttrAccessibleAfterFirstUnlock` (il backup notturno di R9 gira in sottofondo; "Face ID resta il lucchetto della schermata, non della chiave") e "Nessun metodo esporta niente altrove: leggi, scrivi, cancella."

---

## 9. Banchi — cosa controllano esattamente sulla promessa "in locale nessuna richiesta di rete"

Entrambi usano la **stessa tecnica**: si dichiara la modalità locale con un `addInitScript` che scrive `localStorage["jm.mode"] = "local"`, si ascolta `page.on("request")` e si tiene un array `external` di ogni URL che non comincia per `BASE`, `data:` o `blob:`; alla fine si pretende `external.length === 0`.

### `scripts/verify-pr10.mjs` (167 righe, `BASE = http://localhost:3100`)

- **Righe 16-18** — la dichiarazione della modalità:
  ```js
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1"); } catch {}
  });
  ```
  (le due chiavi del saluto servono solo a togliere il velo di mezzo).
- **Righe 24-27** — il filtro:
  ```js
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  ```
- **Riga 120** (desktop 1440x900): `check("locale: ZERO richieste esterne", external.length === 0, external.slice(0, 3).join(" | "))` — **dopo** aver visitato `/app`, salvato una giornata, aperto e chiuso il muro tre volte, ed essere passato per `/app/recap`, `/app/mese`, `/app/remember`.
- **Riga 159** (telefono 430x900): `check("phone locale: ZERO richieste esterne", ...)` — dopo scrittura+salvataggio dalla ManualWrite e il muro `voice`.
- Righe 121, 160: anche **zero errori in console** (`page.on("console")` type `error` + `pageerror`, righe 22-23).
- Riga 114, commento: *"Ricorda: classificazione NON parte in locale (zero richieste esterne più sotto)"* — cioè il banco copre implicitamente `can("aiSummary")` in `remember-client.tsx:57`.

Il resto del banco (28 check circa) non riguarda la rete: larghezze (39, 46, 52, 112, 118, 132), la vista gratis (63-66, 148-149), il muro (71-75, 80, 92, 101), la pill del Mese (110).

**Attenzione:** il check di riga 92 è `"muro: 'prova premium' porta al login"` — cioè il banco **codifica** il comportamento attuale `mode === "local"` → `/login` di `premium-wall.tsx:130-138`. Cambiando quel ramo per l'ospite, questo check diventa rosso: va riscritto, non cancellato.

### `scripts/verify-benvenuto.mjs` (555 righe, `BASE = http://localhost:3200`)

L'intestazione (righe 5-20) elenca **sei promesse in ordine di importanza**, e la **numero 2** (righe 8-9) è: *"in modalità locale non parte NEMMENO UNA richiesta di rete, e il testo arriva da quello cotto nel pacchetto."*

- **Riga 51**: `window.localStorage.setItem("jm.mode", "local")` dentro `nuovoContesto()` (37-60) — con il commento (33-36) che qui il saluto **non** viene silenziato, "perché qui è il soggetto".
- **Righe 62-73**: `osserva(page, errors, external)`, filtro identico a verify-pr10.
- **Tre check sulla rete**, in tre contesti diversi:
  1. **Riga 194**: `check("zero richieste di rete in modalita locale", external.length === 0, external.join(", "))` — sezione 1 "IL VELO", dopo l'apertura di `/app` con il messaggio di benvenuto a schermo. È il check che protegge `benvenuto-client.ts:95` (`if (mode === "cloud") carica()`).
  2. **Riga 460**: `check("zero richieste di rete anche cosi", b.external.length === 0, ...)` — con una **cache `jm.benvenuto` pre-caricata** a mano (righe 441-449, `{ versione: 1, attivo: true, contatto_url: "https://esempio.test/contatti" }`): verifica che la linguetta diventi un `<a href>` vero **leggendo solo la cache**, senza rete. Commento riga 439: *"La cache è la stessa che legge il saluto: nessuna rete."* È il check che protegge `contattoUrlNoto()`.
  3. **Riga 547**: `check("e non chiede niente alla rete", external.length === 0, ...)` — sezione 8, `/admin` a 1440x900 in modalità locale, insieme a riga 546 `check("in modalita locale il pannello admin non disegna niente", n === 0)`. È il check che protegge `admin-client.tsx:49` (`negatoSenzaCloud`) e `:57` (`if (mode !== "cloud") return`).

Anche qui `errors.length === 0` (riga 195).

### Il cambio di contratto che questo lavoro impone

La spec lo mette per iscritto, **sezione 5, righe 268-288**. La promessa vecchia — *"in modalità locale l'app non fa nemmeno una richiesta di rete"*, quella misurata dalle 5 righe qui sopra — **viene rotta dall'ospite**, che tiene le giornate sul dispositivo e chiama l'AI. La promessa nuova, righe 279-281:

> Delle giornate dell'ospite, sul server non resta niente. Il testo esce dal dispositivo solo nel momento in cui l'ospite chiede all'AI di lavorarci, e solo per quello: non viene scritto né conservato da nessuna parte.

E riga 283-284: **"Il banco va riscritto per verificare la promessa nuova, non cancellato. Un banco cancellato è una promessa che smette di esistere in silenzio."** Righe 286-288: la conseguenza va dichiarata anche nell'etichetta privacy dell'App Store e nella pagina privacy.

In pratica il filtro `external.length === 0` va sostituito da qualcosa come "ogni URL esterno appartiene all'elenco chiuso delle route AI, e nessuna scrittura su `entries`/`cassettine` parte" — e va **provato a mordere** (spec riga 425-428: "Un banco che non è mai stato rosso non è una prova, è una decorazione"). I banchi che condividono lo stesso pattern e che quindi vanno rivisti insieme sono anche `scripts/verify-consumi.mjs:158-165` e `scripts/verify-fix-20260820.mjs:43-50, 95`.

---

## Sintesi operativa: i punti dove il codice attuale si oppone all'ospite

| # | Punto | Dove | Perché |
|---|---|---|---|
| 1 | Rimbalzo al login al primo avvio | `auth-gate.tsx:124-127` | viola R1 (zero tocchi) |
| 2 | `/benvenuto` al primo login | `login/page.tsx:122` + `welcome.ts:74` | secondo muro |
| 3 | `can`/`useCan` false in locale | `capabilities.ts:22, 36` | l'AI dell'ospite è spenta per costruzione |
| 4 | Tutte le 7 route AI con `requirePremium` | vedi tabella §3 | l'ospite prende 402 |
| 5 | `ai_usage.user_id uuid not null references auth.users(id)` | `009:8` | un ospite senza account non è loggabile |
| 6 | `profiles.plan check in ('free','premium')` | `006:11` | non c'è posto per una terza condizione |
| 7 | `plan_limits` è per-tier-per-utente, non un totale | `010:7-10` | R4 vuole un tetto **globale** |
| 8 | Nessun indice su `ai_usage(created_at)` | `009:24` | la somma globale del tetto farebbe seq scan |
| 9 | `apiFetch` apre il muro `aiSummary` su ogni 402 | `api.ts:80-86` | per l'ospite il muro giusto è quello della quota finita, non quello premium |
| 10 | Il muro dice "le paghi tu o le pago io" | `premium-wall.tsx:181-183` | testo da riscrivere per chi ha appena finito un regalo |
| 11 | `mode === "local"` → `/login` nel muro | `premium-wall.tsx:130-138` + `verify-pr10.mjs:92` | comportamento **codificato in un banco** |
| 12 | Il pallino/pill dice "Locale" | `account-menu.tsx:69, 303-309`; `settings-client.tsx:731` | l'ospite non è "offline per scelta" |
| 13 | `identitaDispositivo()` in localStorage | `saluto-stato.ts:117-123` | muore con la reinstallazione, R2 riga 73 |
| 14 | "Piani e limiti" è uno span spento | `admin-client.tsx:110` | la voce di R4 va costruita da zero |
| 15 | I 5 check `external.length === 0` | `verify-pr10.mjs:120,159`; `verify-benvenuto.mjs:194,460,547` | contratto da riscrivere (spec §5) |

Non ho modificato nulla.
---

## 10. Proposta del COME (della sessione che ha scritto il referto, NON ancora approvata da Manuel)

- **Il braccialetto (R2):** un segreto casuale di 32 byte generato alla prima
  apertura, tenuto nel portachiavi iOS sincronizzato con `Cassaforte.swift`
  (`conto: "braccialetto"`, stesso plugin, stessa astrazione `chiave.ts`) e
  in IndexedDB sul web. Il server tiene `braccialetti(id, segreto_hash,
  creato_il)` e `braccialetto_giornate(braccialetto_id, giorno)`: una riga
  per giornata su cui l'AI ha lavorato, cosi rilavorare la stessa giornata
  non consuma. Le route AI accettano `Authorization: Braccialetto <segreto>`
  tramite una quarta guardia `requireOspiteOPremium`. Sopravvive alla
  reinstallazione (portachiavi), non sul web (accettato, vedi §8).
- **Ospite -> account:** al primo accesso il client manda il braccialetto e
  il server lo lega a `profiles.braccialetto_id`; la quota resta quella. Un
  account gratis SENZA braccialetto (utenti web vecchi) ne riceve uno alla
  prima chiamata AI. Recap e classificazione dei memo restano premium
  (SPEC §2: i recap sono del gradino 3).
- **Tetto (R4):** tabella `regalo` a una riga (`check (id = 1)` come
  `benvenuto`): `attivo`, `giornate_per_ospite`, `tetto_mensile_usd`.
  `ai_usage` prende `braccialetto_id` (nullable), `user_id` diventa nullable
  con un check "uno dei due", piu una colonna `costo_usd` scritta da
  `logAiUsage` e un indice su `created_at`, cosi la somma del mese e una
  query sola. Sopra il tetto: un braccialetto che ha gia una riga per il
  giorno di oggi finisce quella giornata; uno nuovo riceve 402 `regalo_finito`.
- **Il muro:** `apiFetch` distingue 402 `{ error: "Premium required" }` da
  402 `{ error: "regalo_finito" }` e apre due muri diversi; in locale/ospite
  il tasto non porta piu a /login (verify-pr10 riga 92 va riscritto).
- **Contratto §5:** i cinque check `external.length === 0` diventano "ogni URL
  esterno e una route AI dell'elenco chiuso e nessuna scrittura parte verso
  entries/cassettine/remembers"; da provare a mordere.
