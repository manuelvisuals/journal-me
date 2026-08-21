# Prompt per la sessione sorella (fase 1 dei "fatti")

Copia tutto il blocco qui sotto in una chat nuova di Cowork. E scritto per essere
letto da chi non ha visto nessuna delle nostre conversazioni.

---

Lavori al progetto **Journal.me** insieme a un'altra sessione di Claude che sta
girando in parallelo in un'altra chat. Io sono Manuel, il proprietario. Le due
sessioni non devono pestarsi i piedi: sotto c'e la divisione precisa.

## 1. Il repo

- GitHub: `https://github.com/manuelvisuals/journal-me.git` (branch principale `main`)
- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4
- Supabase (Postgres + Auth), project ref `fljshsmpmpzapcczsbwc`
- Vercel: ogni push su `main` va in produzione su https://journal-me-weld.vercel.app

Per clonare ti serve il mio token GitHub: **chiedimelo in chat come prima cosa**,
usalo nel comando di clone e non scriverlo mai dentro un file, dentro un commit
o dentro la memoria.

Appena clonato, in quest'ordine:

1. `HANDOVER.md` — stato del progetto, regole operative, trappole gia pagate.
2. `SPEC-v2.md` §2 — il contratto dei dati (una interfaccia, due implementazioni).
3. `SPEC-fatti.md` — **il tuo compito**. E autosufficiente: descrive la tabella
   dei fatti, l'estrazione dal racconto, e cosa si vede a schermo.

## 2. Il tuo compito

**Fase 1 di `SPEC-fatti.md`: solo il cibo.** Migration, estrazione, lettura,
schermata. Niente palestra, niente persone, niente umore: quelli vengono dopo,
sulla stessa struttura. Se la spec e il codice si contraddicono, vince il codice
e poi correggi la spec.

Non implementare niente prima che io abbia detto di si alla spec. Se non te
l'ho ancora detto, chiedimelo.

## 3. Divisione del lavoro (la parte che evita i conflitti)

Lavori su un branch tuo: `git checkout -b fatti-fase1`. **Non fare push su
`main`.** Quando hai finito e verificato, dimmelo: il merge lo decido io.

**File che puoi modificare (sono tuoi):**

- `supabase/migrations/011_*.sql` (e successivi)
- `src/lib/data/fatti*.ts`
- `src/components/fatti/**`
- `src/app/api/**` solo per rotte nuove tue
- `src/app/features.css` — **il tuo unico posto per il CSS.** E gia importato in
  cima a `globals.css` apposta per te.
- `src/lib/i18n/en-extra.ts` — **il tuo unico posto per le traduzioni.** La
  funzione `t()` lo consulta prima del catalogo grande.
- `scripts/verify-fatti.mjs` (nuovo, tuo)
- `HANDOVER-fatti.md` (nuovo, tuo)

**File che NON devi toccare (li ha in mano l'altra sessione):**

- `src/app/globals.css` — usa `features.css`
- `src/lib/i18n/en.ts` — usa `en-extra.ts`
- `HANDOVER.md`, `SPEC-v2.md`
- `src/lib/data/cache.ts`, `src/lib/data/warm.ts`
- `src/components/settings/**`, `src/components/day/**`, `src/components/today/**`,
  `src/components/ui/**`

Se ti serve per forza una modifica in un file dell'altra sessione, **fermati e
scrivimelo**: lo coordino io. Un conflitto di merge in un foglio di stile non da
nessun errore, da solo una schermata storta; in un catalogo di traduzioni
perde righe in silenzio.

## 4. Regole non negoziabili (valgono per entrambe le sessioni)

- Email autore dei commit: `spamming.madh52@gmail.com`. **Mai** `madh52@gmail.com`.
- Mai chiedermi di aprire un terminale o di fare passaggi manuali su Supabase,
  Vercel o GitHub: quelle cose le fai tu.
- **Mai SQL o comandi con segnaposto.** Prima ricavi il valore vero, poi esegui.
- Prima di ogni push: `npx tsc --noEmit` e eslint puliti, poi `git push --dry-run`.
- `git add <file espliciti>`. Mai `git add -A`.
- Mai `reset`, `stash`, `rebase`, `cherry-pick`, `clean`.
- Niente emoji in codice, commit, config o markdown.
- Numeri e date in italiano: `LOCALE = "it-IT"`.
- Apostrofi ASCII (`'`), mai quelli tipografici: c'e un test che li rifiuta.
- Ogni cambiamento visivo non banale: prima un mockup HTML e il mio ok esplicito.
- Una domanda per risposta, con opzioni numerate.
- Prima di dire "fatto": verificato davvero, non solo compilato.

## 5. Trappole dell'ambiente gia pagate (non riscoprirle)

- **Push:** il proxy git blocca `git push`. Funziona cosi:
  `git -c http.proxy= -c https.proxy= push origin fatti-fase1`
- **Dev server / test:** i test Playwright vogliono `node_modules` veri. Copia il
  sorgente in una cartella di build con percorsi **assoluti** (`cp -r /percorso/src ...`,
  mai relativi: falliscono in silenzio) e riavvia il server dopo ogni copia.
  Usa la tua porta: **3200**, cartella **`/tmp/jm-build-b`**. La 3100 e
  `/tmp/jm-build` sono dell'altra sessione.
- Per fermare il server: `fuser -k 3200/tcp`. **Mai** `pkill -f "next dev"`:
  il pattern colpisce anche la shell che lo lancia e si suicida.
- Chromium per Playwright: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
- **Supabase:** il pannello web non disegna niente quando Chrome e in secondo
  piano. Usa la Management API dalla scheda gia loggata:
  `POST https://api.supabase.com/v1/projects/fljshsmpmpzapcczsbwc/database/query`
  con il token in `localStorage["supabase.dashboard.auth.token"]`.
- **Chrome e uno solo e lo condividiamo.** Prima di guidarlo, chiedimelo:
  se lo usiamo in due insieme ci ostacoliamo. Per i tuoi test usa Playwright
  nel tuo container, che e separato.
- Quando io dico "non salva", **chiedilo al database prima di leggere il
  codice**: l'ultima volta salvava benissimo, ma sul giorno sbagliato.

## 6. Come mi parli

In italiano, senza gergo. Alla fine di ogni risposta una sezione
_"In parole povere"_ in corsivo, massimo 5 righe, che mi dice cosa sta
succedendo, cosa devo fare io e qual e il prossimo passo.
