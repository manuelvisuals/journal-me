# Handover · Journal.me

Documento per la nuova chat Cowork che riprende lo sviluppo. Tutto quello che serve sapere per partire senza riassemblare contesto.

---

## 1. Cos'è Journal.me

App web mobile-first di journaling personale per Manuel (utente unico, italiano, iPhone come primary device). Concetto:

- Fine giornata → notifica → apre l'app → parla a voce libero in italiano (emozioni, nomi, eventi, alla rinfusa)
- L'app trascrive 1:1 (testo è la sorgente di verità, audio si butta)
- AI genera: headline "tipo notizie di borsa" + snippet 2-3 righe + versione espansa per macro-aree (Lavoro / Relazioni / Corpo / Emozioni)
- Vista Mese: dense row-per-day con summary schematico, micro-goal dots, peso, sonno, mood
- Recap mensili/semestrali/annuali con **tono narrativo letterario** (non stock-news, diversamente dal daily)
- Sezione Remember: quick-capture per persone/libri/todo/note (manuali o auto-estratte dal racconto serale)

Sezioni future già menzionate: Palestra (allenamenti con set/peso/macchinari, AI come personal trainer).

---

## 2. Stack & deploy

```
Next.js 16.2.6 (App Router, TS, Tailwind v4) + Turbopack
React 19.2.4
@supabase/supabase-js + @supabase/ssr
Inter via next/font/google (variable font)

GitHub:    https://github.com/manuelvisuals/journal-me
Vercel:    https://journal-me-chi.vercel.app  (deploy live, funzionante)
Supabase:  https://sxpijppbedgucdmiitkr.supabase.co  (project ref: sxpijppbedgucdmiitkr)
```

Vercel ha le 3 env vars settate (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Auto-deploy on push to `main`.

`.env.local` esiste nel workspace folder (gitignored) con le stesse 3 var per dev locale.

---

## 3. Hard rules operative (da rispettare in ogni risposta)

Già salvate in memoria persistente come `workflow_manuel.md`. Sintesi:

1. **Git author email**: `spamming.madh52@gmail.com`. NON `madh52@gmail.com`. Imposta sempre nel sandbox: `git config --global user.email "spamming.madh52@gmail.com"` + `user.name "Manuel"`.
2. **Mai chiedere a Manuel di aprire il terminale**. Se serve, reframe come SQL paste-able in Supabase SQL Editor, o lo esegui tu nel sandbox bash.
3. **`tsc --noEmit` clean prima di ogni push**. ESLint pure deve passare.
4. **Cambi visivi non triviali = mockup HTML prima** in `design/mockups/`, computer:// link, attendi OK esplicito di Manuel, POI tocchi codice di produzione. Stretto.
5. **No emoji in code/config/commit**. Mai. Tranne se Manuel chiede esplicitamente.
6. **Italian number formatting** via `LOCALE = "it-IT"` constant in `src/lib/format.ts`. Mai `toLocaleString(undefined, ...)` sparso.
7. **Una domanda per volta**, non quattro insieme.
8. **Push-back, non yes-man**. Manuel apprezza che dici "no" o "questa cosa non torna" quando è il caso.

Workflow split:
- Claude: code edits, file creation, git (commit/push/branch), tsc check, eslint, migrations SQL writing in `supabase/migrations/`, Chrome verify.
- Manuel: SQL execution in Supabase SQL Editor, opening `computer://` links, file drag-drop, account connections (Vercel ↔ GitHub ↔ Supabase via UI web), screenshots.

---

## 4. Identità visiva (validata, NON cambiare senza nuovo OK)

> **FONTE DI VERITÀ → `design/brandbook.html`**
> Il brandbook è il documento canonico del look dell'app: pensato perché un'altra
> persona/AI possa ricostruire l'intera UI da zero anche se sparisse tutto il CSS.
> Contiene 19 capitoli (filosofia, colore, tipografia, superfici, spazio, raggi,
> ombre, bottoni, input, card, navigazione, registrazione, editoriale/recap,
> movimento, icone, voce&tono, stati, da-non-fare, export tokens) con esempi dal
> vivo e l'export `@theme inline` pronto al copia-incolla. Apri come `computer://`
> link. **Prima di qualsiasi cambio visivo, leggi il brandbook + il mockup
> relativo in `design/mockups/`, poi proponi un mockup nuovo.** I token qui sotto
> sono un estratto rapido; in caso di conflitto vince il brandbook.

Tema "wine premium" + Inter (UI) / Spectral (prosa editoriale). Tutte le tokens in `src/app/globals.css`:

```
--color-bg            #050304   (page outer)
--color-bg-phone      #0E0709   (app body)
--color-surface       #1D1013   (cards, input)
--color-surface-2     #241418
--color-line          rgba(255,229,214,.075)
--color-accent        #E3A15F   (amber - solo accento)
--color-accent-pressed #D08F4D
--color-accent-hi     #F0B875
--color-ink           #F4E7DE   (testo primario, cremoso)
--color-ink-muted     #CDB7AE
--color-ink-faint     #8E7770
--color-success       #A8C9B0
--color-danger        #F87171
--font-sans           Inter via next/font + system fallbacks
```

Body globale ha radial-gradient di warmth in alto-sinistra (wine) + film grain noise via SVG fractalNoise a opacity 2.8%. Vedere `globals.css` body::before e body::after.

Tipografia: **Inter** per la UI/numeri, **Spectral** per la prosa editoriale (recap, citazioni, titoli editoriali tipo la card Recap dentro Altro, drop cap). Contrasto via peso (300 thin per numeri grossi, 650 bold per headline, 400-500 per body) + tracking negativo (-0.025em sulle headline). Dettaglio scala completa nel brandbook cap. 03.

Buttons hanno feedback al tap già definito in `globals.css` (`.btn-primary` + `.btn-ghost`):
- scale(0.97) + shadow flatten + color sink + 80ms cubic-bezier(0.4, 0, 0.2, 1)
- `-webkit-tap-highlight-color: transparent` + `touch-action: manipulation`
- Wrap in `src/components/ui/button.tsx` con `variant: "primary" | "ghost"`

Input: `.input-base` class, focus genera amber-glow border.

Brandbook: `design/brandbook.html` (fonte di verità, vedi callout sopra).
Mockup di riferimento in `design/mockups/`: `login.html`, `today.html`, `mese.html`, `recap.html`, `remember.html`, `settings.html`, `metrics-editable.html`, `recording-flow-v2.html`, `altro.html` (Recap card + glossario + logout, approvato), `recording-overlay-v3.html` (status sopra waveform + X come cestino rosso, approvato).

---

## 5. Quirks del sandbox da sapere

**npm install è lentissimo sul mount.** Il filesystem dove vive la workspace (`/sessions/.../mnt/`) è troppo lento per `npm install` (timeouts >45s). Pattern usato:

```bash
# 1. Install deps in /tmp (fs locale veloce)
mkdir -p /tmp/jm-deps
cp /sessions/vigilant-loving-cannon/mnt/03\ Journal.me/package.json /tmp/jm-deps/
cd /tmp/jm-deps && npm install --no-audit --no-fund

# 2. /tmp/jm-work è il working directory git (clone fresco da origin)
git clone https://github.com/manuelvisuals/journal-me.git /tmp/jm-work
cd /tmp/jm-work
ln -sfn /tmp/jm-deps/node_modules /tmp/jm-work/node_modules
cp /tmp/jm-deps/package.json /tmp/jm-deps/package-lock.json /tmp/jm-work/

# 3. Quando scrivi file nuovi → Write tool nella workspace folder (/Users/...)
# 4. Sync workspace → /tmp/jm-work via rsync (escludi node_modules, .git, .next)
# 5. Run tsc + eslint in /tmp/jm-work
# 6. git commit + push da /tmp/jm-work
```

**Build locale fallisce** per il symlink di node_modules (Turbopack non gradisce). Va bene così: Vercel fa npm install fresco e builda correttamente. Skip `next build` locale, fidati di tsc + eslint + deploy verify.

**Mount filesystem ha permessi strani**: `rm` su file nella workspace folder spesso fallisce con "Operation not permitted" anche su file scritti da Claude. Non insistere — gestisci le delezioni solo in `/tmp/jm-work`, committa la rimozione, e il workspace mirror semplicemente sarà leggermente disallineato (non importa: la fonte di verità è GitHub).

**Sandbox può essere wiped** tra una conversazione e l'altra (o anche dentro la stessa, raramente). Re-clone da GitHub + re-install in /tmp. Il workspace folder persiste sul Mac.

---

## 6. Git credentials

Manuel ti darà un Personal Access Token classic (formato `ghp_*`) con scope `repo`, expiry breve (7 giorni). Setup nel sandbox:

```bash
cat > /tmp/.gc <<'EOF'
https://manuelvisuals:GHP_TOKEN_HERE@github.com
EOF
chmod 600 /tmp/.gc
cd /tmp/jm-work
git config credential.helper "store --file=/tmp/.gc"
```

Dopo aver pushato il pezzo di lavoro, ricordagli di revocare il token su https://github.com/settings/tokens.

---

## 7. Stato attuale — cosa è già fatto

Git log (4 commits su main):

```
8024a17  Auth + wine premium theme: login page, magic link, demo bypass
01ff00a  Add initial Supabase schema migration
16cbacd  Initial Journal.me setup
cc2a48a  Initial commit from Create Next App
```

### Cosa funziona già live su Vercel:

- **Auth gate** via `src/proxy.ts` (Next.js 16 ha rinominato middleware → proxy, NON usare `middleware.ts`): se non auth + no demo cookie → redirect a `/login`.
- **/login**: form magic link via `supabase.auth.signInWithOtp`, salva ultima email in localStorage tramite `useSyncExternalStore` (NON useEffect+setState, React 19 ha una nuova regola lint che lo flagga). Greeting "Benvenuto" prima volta / "Bentornato" se ritorna. 3 stati: form vuoto, form pre-filled per returning, success (link inviato).
- **/auth/callback**: scambia il code per session (PKCE flow via `exchangeCodeForSession`).
- **/api/demo** (POST): set cookie `journalme-demo=1`, redirect a `/`.
- **App tour demo button** sul login: bottone ghost outlined con tag `DEMO`. Click → POST `/api/demo` → router.push("/").
- **Home page** (`src/app/page.tsx`): se auth → "Bentornato. ciao [email-username]", se demo cookie → "Modalita demo." con banner "APP TOUR" in alto.
- **Schema Supabase**: `supabase/migrations/001_init.sql` è stato applicato. 5 tabelle (entries, goals, entry_goals, remembers, recaps) + RLS policies + trigger su `auth.users` che seed 6 default goals di Manuel (scopato, no alcol, no junkfood, no sbirciato ex, camminato, visto sunset).

### File chiave già scritti:

```
src/
├── app/
│   ├── api/demo/route.ts          POST set demo cookie
│   ├── auth/callback/route.ts     magic link return
│   ├── login/page.tsx             login form + demo bypass
│   ├── globals.css                wine theme tokens + button/input classes
│   ├── layout.tsx                 Inter font, lang=it, viewport iOS
│   └── page.tsx                   home auth-aware
├── components/ui/button.tsx       <Button variant="primary"|"ghost">
├── lib/
│   ├── format.ts                  LOCALE it-IT + formatters
│   └── supabase/
│       ├── client.ts              createBrowserClient
│       ├── server.ts              createServerClient (RSC + route handlers)
│       └── middleware.ts          updateSession (refresh cookies + auth gate logic)
└── proxy.ts                       Next.js 16 auth gate (NOT middleware.ts)
```

`design/mockups/`:
- `login.html` — 3 stati login + comparison riposo/premuto per buttons
- `today.html` — 3 stati Today (empty, recording, filled), **già approvato da Manuel**

`design/button-press-feedback.txt` — concept doc da passare ad altre chat che usano lo stesso tema.

---

## 8. PROSSIMO TASK · Today screen (mockup approvato, da implementare)

Manuel ha detto OK sul mockup `design/mockups/today.html`. Devi implementare la versione production.

### Scope MVP (questo task):

**Stato 1 — Vuoto** (no entry oggi):
- Date header in alto a sinistra (LUN · 18 MAG style, italian short day + day + month abbreviato)
- Centro: "Com'e andata oggi?" big bold, hint sotto
- Big mic button gold con glow ambra
- Tab bar in basso (Oggi attivo · Mese · Recap · Remember)

**Stato 2 — Recording overlay** (full screen takeover):
- Live indicator + timer in alto
- Transcript area centro: tre tonalità (older / recent / now) + caret lampeggiante
- Tagged spans (le entità AI riconosce) in ambra inline
- Waveform mini animato
- Controls: cancel X · stop big red glowing · pause
- Footer: "audio sul telefono · solo testo va al cloud"

**Stato 3 — Filled** (entry registrata):
- Date header + "originale ↗" link top-right
- Headline 26px font-weight 650
- Snippet 14px ink-muted
- Macro areas (LAVORO · RELAZIONI · CORPO) con label ambra ALL CAPS
- 3 metric cards (peso `78,2 kg` formato italiano, sonno `7h 12`, mood emoji)
- 6 goal dots (fillerati o vuoti)
- Tab bar identica

### Decisioni tecniche concordate:

- **Trascrizione MVP = Web Speech API del browser** (gratis, real-time, italiano via `recognition.lang = 'it-IT'`). Funziona su Safari iOS, Chrome desktop. iOS Safari auto-stops dopo ~60s — gestire con `onend` handler che fa restart se `isRecording` true.
- **AI processing differito**: dopo stop, MVP fa headline placeholder ("Giornata raccontata in N minuti") + snippet = prima frase del transcript. Aree macro vuote. Manuel passerà OPENAI_API_KEY in seguito → swap a `gpt-4o-realtime` per trascrizione qualità top + chiamata OpenAI per generare headline/snippet/aree.
- **Multi-recording stesso giorno = sovrascrive** (semplice MVP). Più avanti vediamo append.
- **Goal dots, metriche tappabili = visualizzati statici per ora**. Persistenza + tap-to-edit nei task successivi.
- **Demo mode** (cookie `journalme-demo=1` senza `auth.users` reale): le entries non possono andare in Supabase perché `entries.user_id` ha FK su `auth.users(id)`. Per demo, salva entry in localStorage. Per auth real, su Supabase. Implementare uno strato `src/lib/data/entries.ts` con `saveEntry({ transcript, ...})` che switcha tra i due in base a session/demo state.

### Da scrivere:

1. `src/app/page.tsx` — diventa il Today screen vero (sostituisce placeholder attuale)
2. `src/components/today/empty-state.tsx` — empty state con big mic
3. `src/components/today/recording-overlay.tsx` — full-screen overlay con Web Speech API
4. `src/components/today/filled-view.tsx` — versione filled con headline/snippet/aree/metriche/dots
5. `src/components/ui/tab-bar.tsx` — tab bar bottom (Oggi · Mese · Recap · Remember)
6. `src/lib/data/entries.ts` — data layer (Supabase + localStorage demo split)
7. `src/lib/types.ts` — Entry type
8. Eventualmente `src/app/(app)/layout.tsx` se serve un layout condiviso con tab bar

### Suggerimento ordine implementativo:

1. Tab bar component + layout shell
2. Empty state (statico, no recording yet)
3. Data layer (saveEntry / loadTodayEntry, con switch demo/real)
4. Recording overlay con Web Speech API
5. Filled view
6. Wire it all up nella page.tsx (state-based switching)
7. tsc + eslint + commit + push + Chrome verify

---

## 9. Decisioni differite (da chiarire con Manuel quando appropriato)

- **OpenAI Realtime API key**: Manuel deve fornire `OPENAI_API_KEY` quando vuole qualità top per trascrizione + AI processing. Costo previsto ~€18/anno per 10min/giorno. Niente.
- **Logout button**: ancora nessuno. Quando arriverà il momento, decidere dove metterlo (in alto a destra? Settings?). Per ora demo si esce solo cancellando cookie a mano o re-login con email.
- **Settings page** + customization micro-goals: differito a dopo Today.
- **Backfill / giorni mancanti**: pattern UX già discusso (banner "Hai saltato 3 giorni", lista tappabile). Non implementato.
- **Recap mensile/semestrale/annuale**: schema in DB pronto (`recaps` table), nessuna UI ancora.
- **Remember section**: schema in DB pronto, nessuna UI.
- **Numeri italiani**: l'unico posto che li mostra ora è il mockup Today (peso "78,2 kg"). Quando wiri il filled view production, usa `formatDecimal` da `src/lib/format.ts`.

---

## 10. Note finali per la nuova chat

- **Tono**: italiano, conversazionale, push-back culture. Non yes-man.
- **Lunghezza**: Manuel preferisce risposte concise + azione. Non riassumere quello che hai appena fatto se è ovvio dal diff.
- **Una domanda per volta** quando hai bisogno di confirm. Mai 4 questions.
- **Mockup-first** è non negoziabile per visual changes.
- **Push every chiusura task**, dopo aver verificato tsc + eslint clean + Chrome verify.
- **Memoria persistente**: scrivici dentro qualsiasi decisione nuova che dovrebbe vivere oltre questa chat. Path:  
  `/Users/manuel/Library/Application Support/Claude/local-agent-mode-sessions/.../spaces/.../memory/`

Quando inizi:
1. Leggi `HANDOVER.md` (questo file)
2. Verifica memoria persistente (MEMORY.md + i 3 file project/user/workflow)
3. Setup sandbox: `/tmp/jm-deps` + `/tmp/jm-work` come descritto sezione 5
4. Chiedi a Manuel un fresh PAT per git push quando serve
5. Conferma con Manuel: "Ho letto l'handover, partiamo dal Today screen production?" → aspetta OK → procedi

Buon lavoro.
