<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Scheletro e moduli (regole per OGNI sessione, dal 23 agosto 2026)

Leggi `ARCHITETTURA.md` prima di toccare codice: e la mappa di cosa e scheletro e cosa
e modulo. Poi leggi il `CLAUDE.md` della cartella in cui lavori: e il tuo recinto.

Le regole comuni, valide in ogni cartella:

1. **Un modulo per chat.** Lavori dentro `src/modules/<tuo modulo>/` (piu le pagine
   di `src/app/` che il tuo CLAUDE.md elenca). Se il compito richiede di toccare lo
   scheletro (`src/lib`, `src/themes`, `src/components`, `src/styles`, `src/app/globals.css`)
   o un altro modulo, fermati e dillo a Manuel invece di sconfinare.
2. **Branch, non main** (`WORKERS.md`): un modulo = un branch = una chat. Su `main` si
   arriva per merge. Eccezione: una sessione scheletro dichiarata, quando e l'unica
   attiva.
3. **Dove si scrive cio che e nuovo.** Dal passo D ogni modulo e una cartella,
   `src/modules/<nome>/`: dentro ci sono `components/`, `styles.css` (il CSS del
   modulo), `en.ts` (le sue traduzioni) e `index.ts` (la PORTA: l'unica cosa che gli
   altri moduli possono importare — il lint dei confini e a ERRORE). `globals.css` e
   `src/lib/i18n/en.ts` sono solo indici e non si toccano; `src/styles/base.css` e
   `overrides.css` e `catalogs/comune.ts` sono scheletro (un pezzo condiviso nuovo va
   discusso). `features.css` e `en-extra.ts` restano come innesti d'emergenza.
4. **Solo token, mai valori a mano**: colori, raggi e spazi vengono dal contratto temi
   (`--color-*`, `--jm-*`); ogni `font-size` e `calc(Npx * var(--jm-ui-scale))`.
   Testo a schermo sempre via `t()` (`@/lib/i18n`).
5. **Prima di ogni push**: `npx tsc --noEmit && npx eslint .` puliti, piu il banco del
   tuo modulo (elencato nel suo CLAUDE.md) e `node scripts/verify-i18n.mjs`.
   Un errore ESLint "confine fra moduli" significa che sei fuori recinto: rientra
   (o passa dalla porta `@/modules/<nome>`), non chiedere eccezioni al lint.
6. **Un comando da Terminale per Manuel si scrive come dice `REGOLE-TERMINALE.md`.**
   In sintesi: una riga sola che chiama uno script versionato; mai
   `>/dev/null 2>&1` su cio che puo chiedere input; `GIT_TERMINAL_PROMPT=0`;
   un tetto di tempo su ogni passo di rete (`timeout` su macOS non esiste);
   target bash 3.2; verdetto unico in fondo. E mentre lui esegue, la sessione
   NON tocca la cartella collegata: due git sullo stesso `.git` si appendono,
   e lo script accusa la rete che invece funziona.
<!-- END:nextjs-agent-rules -->
