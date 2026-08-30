# Prompt per la sessione SCHELETRO: la barra in alto

Manuel: apri una chat nuova sul progetto e incolla **tutto il blocco fra le due righe
orizzontali**. Non c'e niente da riempire.

---

Lavori su dayalogue, repo `manuelvisuals/journal-me` (deploy automatico su Vercel).

QUESTA E UNA SESSIONE SCHELETRO. Il compito tocca il guscio e le intestazioni di
cinque moduli: un worker di modulo non potrebbe farlo, ed e il caso previsto da
ARCHITETTURA.md §2 ("se un modulo ha bisogno di una primitiva nuova, la chiede").

IL COMPITO: **una barra in alto vera, uguale su ogni schermata del telefono**, con il
nome della schermata a sinistra e il pallino dell'account a destra. Scelta di Manuel
il 28 agosto 2026 ("strada B").

IL MOCKUP APPROVATO: `design/mockups/pallino-ovunque.html`. **Aprilo e prova la strada
B** prima di scrivere una riga: nei comandi in alto scegli "B . barra in alto" e cambia
schermata. Quello e il bersaglio.

## Da dove nasce

Il pallino con la foto profilo compare **solo su Oggi**: navigando sparisce, e l'app
sembra di due persone diverse. La causa e che era montato dentro l'intestazione di una
schermata sola.

Il piano precedente — "una riga di `<AccountMenu variant="testata" />` in ogni modulo" —
e stato **abbandonato di proposito**, ed e importante che tu non lo riprenda: le
intestazioni del telefono hanno contenuti diversi (vedi l'inventario sotto), quindi il
pallino finirebbe in cinque allineamenti leggermente diversi, e nessuna guardia
impedirebbe al sesto modulo di sbagliare. Sarebbe lo stesso difetto, piu grande.

## L'inventario, gia misurato (non rifarlo)

| schermata | intestazione oggi | cosa c'e a destra |
|---|---|---|
| Oggi | `today-client.tsx:659`, `.jm-col-head` | "modifica ↗", due bottoni tondi 44px, **il pallino** |
| Mese | `mese-client.tsx:269`, `.jm-month-header` (sticky, `lg:hidden`) | contatore "12/31", due frecce, interruttore lista/griglia |
| Ricorda | `remember-client.tsx:105`, `.jm-rem-head` | niente: titolo + riga di chip filtro |
| Recap | `recap-client.tsx:100`, `.jm-rec-head` | niente: titolo + segmented dei periodi |
| Giorno | `day-client.tsx:307`, `.jm-day-head` | — |
| Persona | `persona-client.tsx:40`, `.jm-day-head` | — |
| Palestra | nessuna intestazione | — |
| Impostazioni | `.jm-col-head` e `PanelHead` (rows.tsx) | — |

## Cosa costruire

1. **Una primitiva di scheletro**, per esempio `src/components/ui/app-bar.tsx`: una
   barra sottile in cima, **solo sotto lg**, con il titolo della schermata a sinistra e
   `<AccountMenu variant="testata" />` a destra. Montata **una volta** dal guscio
   (`src/components/desktop/desktop-shell.tsx`, che sotto lg e `display: contents`) o da
   `src/app/layout.tsx` — decidi tu, ma **una volta sola**: e tutto il punto.
2. **Il titolo**: ogni schermata deve poter dire come si chiama. Serve un canale (uno
   store come `apriPannelloNome` in `src/modules/impostazioni/profilo.ts`, oppure una
   mappa pathname → titolo nella barra stessa). La mappa e piu semplice e non tocca i
   moduli: valutala per prima.
3. **Le intestazioni attuali si alleggeriscono**: il titolo sale nella barra, quello che
   resta (i chip di Ricorda, il segmented di Recap, i controlli di Mese) scende sotto.
   Su **Oggi** il pallino esce dall'intestazione: `today-client.tsx` perde
   `<AccountMenu variant="testata" />` e il suo `<span className="lg:hidden">`.
4. **Le pagine pubbliche non hanno la barra**: login, /benvenuto, /auth, privacy. Il
   segnale esiste gia: `useDentroApp()` in `src/components/ui/tab-bar.tsx`.

## Le trappole, gia note

- **Non rifare la lettura del profilo.** Nome e foto arrivano da UNA query sola, dallo
  store del modulo impostazioni, via la sua PORTA: `useProfilo`, `useNomeMostrato`,
  `apriPannelloNome` da `@/modules/impostazioni`. Non aggiungere una seconda `select` su
  `profiles`, e non ricalcolare mai il nome dall'email: quella regola vive in
  `profilo-contract.ts` (`nomeMostrato`) e `scripts/verify-nome-profilo.mjs` esce rosso
  se qualcuno rimette uno `split("@")` in `account-menu.tsx` o `settings-client.tsx`.
- **Su desktop non deve cambiare NIENTE.** Da lg in su il pallino sta in fondo alla rail
  sinistra, che e gia presente ovunque. La barra e solo sotto lg. `verify-pr8.mjs` e
  `verify-impostazioni.mjs` guardano il guscio desktop: devono restare verdi.
- **Mese ha una sticky.** `.jm-month-header` e `position: sticky; top: 0`: con una barra
  sopra, quel `top` non e piu zero. Controllalo, o il mese si incolla sotto la barra.
- **La safe-area dell'iPhone.** Oggi `padding-top: env(safe-area-inset-top)` sta nelle
  intestazioni (`.jm-col-head`); se il titolo sale nella barra, quel padding va spostato
  li, o sotto il notch resta un buco o una sovrapposizione.
- **Il microfono al centro della barra in basso non si tocca.** Mai.

## Le regole che rompono tutto se le sbagli

- **Branch, mai main.** Crea `scheletro-barra-alto` da `origin/main` e pusha SOLO
  quello. Se il push risponde 403 "access denied by the git proxy", ripeti con
  `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY -u ALL_PROXY -u all_proxy git push origin <branch>`.
- **git**: email `spamming.madh52@gmail.com`; `git add <file espliciti>`, mai `-A`;
  niente reset/rebase/stash/clean; `git push --dry-run` prima del push.
- **Solo token del tema** (`--color-*`, `--jm-*`), mai colori o misure a mano; ogni
  font-size e `calc(Npx * var(--jm-ui-scale))`; ogni testo a schermo passa da `t()`.
  Le frasi nuove condivise vanno in `src/lib/i18n/catalogs/comune.ts`.
- **Ambiente di verifica** (il filesystem montato e troppo lento per npm install):
  ```
  git clone https://github.com/manuelvisuals/journal-me.git /tmp/jm-b
  mkdir -p /tmp/jm-deps && cp /tmp/jm-b/package*.json /tmp/jm-deps/
  cd /tmp/jm-deps && npm install --no-audit --no-fund
  ln -sfn /tmp/jm-deps/node_modules /tmp/jm-b/node_modules
  ```
- **Prima di dichiarare finito**: `npx tsc --noEmit && npx eslint .` puliti,
  `node scripts/verify-i18n.mjs`, `node scripts/verify-css-split.mjs`,
  `node --experimental-strip-types scripts/verify-foto-profilo.mjs` e
  `verify-nome-profilo.mjs`, piu `verify-impostazioni`, `verify-pr8`, `verify-mese-nav`.
  Scrivi un banco nuovo che verifichi la cosa che conta: **il pallino e nello stesso
  punto su tutte le schermate**, e su desktop non c'e. E **PROVALO A MORDERE**:
  rimetti il pallino dentro l'intestazione di Oggi, guarda il banco diventare rosso,
  ripristina.
- **Fermati a uno stato pulito.** Meglio la barra su tutte le schermate senza rifiniture
  che meta app con la barra e meta senza.

## Cosa NON serve fare

Le migration 016 e 017 sono **gia applicate** su Supabase. Foto profilo, ritaglio, nome
e pennina **funzionano gia**: non riscriverli. Questo compito sposta soltanto DOVE sta
il pallino sul telefono.

Manuel legge le risposte in italiano. Non e un tecnico: spiega le scelte in parole
semplici e — quando serve una decisione — UNA domanda per risposta, con opzioni
numerate. Sii onesto sul non-fatto: un "fatto" detto prima di aver verificato nel
browser e una bugia, non una cortesia. In particolare: **nessuna sessione finora e
riuscita ad aprire un browser** su questo repo (Playwright non installa Chromium senza
root, e i file locali non si aprono), quindi se non hai potuto guardare con gli occhi,
dillo invece di lasciarlo intendere.

---

## Nota per Manuel

Dopo che la chat nuova ha pushato `scheletro-barra-alto`, il merge su `main` lo puoi
chiedere a lei o a me. Poi serve un giro di `aggiorna-e-apri-xcode.command` per portarlo
sul telefono.
