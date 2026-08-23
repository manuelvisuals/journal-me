<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Scheletro e moduli (regole per OGNI sessione, dal 23 agosto 2026)

Leggi `ARCHITETTURA.md` prima di toccare codice: e la mappa di cosa e scheletro e cosa
e modulo. Poi leggi il `CLAUDE.md` della cartella in cui lavori: e il tuo recinto.

Le regole comuni, valide in ogni cartella:

1. **Un modulo per chat.** Lavori nel perimetro scritto nel CLAUDE.md del tuo modulo.
   Se il compito richiede di toccare lo scheletro (`src/lib`, `src/themes`,
   `src/components/ui`, `src/components/desktop`, `src/app/globals.css`, `en.ts`) o un
   altro modulo, fermati e dillo a Manuel invece di sconfinare.
2. **Branch, non main** (`WORKERS.md`): un modulo = un branch = una chat. Su `main` si
   arriva per merge. Eccezione: una sessione scheletro dichiarata, quando e l'unica
   attiva.
3. **Dove si scrive cio che e nuovo.** CSS: nel file del TUO modulo,
   `src/styles/<modulo>.css` (dal passo B ogni modulo ha il suo; `globals.css` e solo
   l'indice degli import e non si tocca). Un pezzo che serve a piu moduli va discusso:
   `base.css` o `overrides.css` sono scheletro. `features.css` resta per gli innesti
   temporanei trasversali. Traduzioni nuove da branch: `src/lib/i18n/en-extra.ts`,
   mai in coda a `en.ts` (il passo C non e ancora fatto).
4. **Solo token, mai valori a mano**: colori, raggi e spazi vengono dal contratto temi
   (`--color-*`, `--jm-*`); ogni `font-size` e `calc(Npx * var(--jm-ui-scale))`.
   Testo a schermo sempre via `t()` (`@/lib/i18n`).
5. **Prima di ogni push**: `npx tsc --noEmit && npx eslint .` puliti, piu il banco del
   tuo modulo (elencato nel suo CLAUDE.md) e `node scripts/verify-i18n.mjs`.
   I warning ESLint "confine fra moduli" non bloccano ma vanno riferiti a Manuel.
<!-- END:nextjs-agent-rules -->
