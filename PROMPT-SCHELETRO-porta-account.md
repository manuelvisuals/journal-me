# Il prompt per la sessione SCHELETRO: la porta dell'account

Manuel: apri una chat nuova e incolla **tutto il blocco fra le due righe orizzontali**.
Non c'e niente da riempire: il compito e gia deciso e il mockup e gia approvato.

Perche serve una sessione scheletro e non un worker di modulo: questo lavoro tocca
`src/components/desktop/rail-left.tsx`, `src/components/ui/tab-bar.tsx`,
`src/styles/base.css` e `src/lib/`, che ARCHITETTURA.md §2 dichiara SCHELETRO. Un
worker di modulo ha il divieto di scriverci. E il caso che il documento prevede:
"se un modulo ha bisogno di una primitiva nuova, la chiede".

---

Lavori su dayalogue, repo `manuelvisuals/journal-me` (deploy automatico su Vercel).

QUESTA E UNA SESSIONE SCHELETRO, non un worker di modulo: hai il permesso di scrivere
in `src/components/**`, `src/styles/**` e `src/lib/**`. Non e un permesso generale: e
limitato all'elenco di file del punto "Il perimetro" qui sotto. Tutto cio che non e in
quell'elenco resta fuori dal recinto anche per te.

IL COMPITO: le impostazioni si aprono dal pallino dell'account, non da un menu dedicato.
Il pallino diventa un bottone che apre un menu con Impostazioni / Premium / Esci; la
voce "Impostazioni" esce dalla navigazione desktop e dalla barra del telefono, che cosi
riguadagna il posto per Ricorda.

IL MOCKUP APPROVATO, che e la specifica: `design/mockups/porta-account.html`.
**Aprilo e leggilo prima di scrivere una riga.** Non e un'illustrazione: la sezione 03
e un contratto, riga per riga, con i riferimenti al codice vero. Se una riga di quel
contratto non e vera nel browser, il lavoro non e finito. Il mockup precedente
`design/mockups/impostazioni-dal-pallino.html` mostra le alternative scartate: leggilo
solo se ti serve capire perche si e scelto cosi.

Prima di toccare qualsiasi file, in quest'ordine:
1. leggi `ARCHITETTURA.md` (la mappa: scheletro e moduli, e a che punto e il piano);
2. leggi `AGENTS.md` (le regole comuni a tutte le sessioni);
3. leggi `WORKERS.md` (il protocollo di lavoro in parallelo: e vincolante);
4. apri `design/mockups/porta-account.html` e leggi tutta la sezione 03;
5. leggi i CLAUDE.md di `src/modules/impostazioni/` e `src/modules/oggi/`: sono i due
   moduli che questo lavoro sfiora, e devi sapere cosa raccontano prima di cambiarli.

## Il perimetro: gli unici file che puoi toccare

Scheletro, da cambiare:
- `src/components/desktop/rail-left.tsx` — il blocco account diventa un bottone; la
  voce di navigazione `key: "altro"` sparisce (con lei il tipo `NavKey` e il ramo
  `/settings` di `activeKeyFor`).
- `src/components/ui/tab-bar.tsx` — via lo slot "settings"; Ricorda torna fisso; il
  modulo acceso prende il quinto posto; senza moduli la griglia e a quattro colonne,
  non a cinque con un buco.
- `src/styles/base.css` — il CSS del bottone account e del menu.
- `src/lib/i18n/catalogs/comune.ts` — le frasi nuove (sono condivise, non di un modulo).

Scheletro, da creare:
- `src/components/ui/account-menu.tsx` — il pezzo nuovo: bottone + menu, popover da
  1024px in su, foglio dal basso sotto.
- `src/components/ui/sheet.tsx` — la primitiva del foglio dal basso (vedi sotto).
- `src/lib/auth/logout.ts` — il logout estratto una volta sola.

Moduli, con una modifica sola ciascuno, spiegata nel contratto:
- `src/modules/impostazioni/components/settings-client.tsx` — `handleLogout` perde il
  corpo e chiama `src/lib/auth/logout.ts`. Nient'altro di questo file cambia.
- `src/modules/oggi/components/add-to-day.tsx` e `src/modules/oggi/styles.css` — il
  foglio dal basso che c'e gia li dentro viene promosso a scheletro.
- `src/modules/oggi/components/today-client.tsx` — il pallino entra nell'intestazione
  di Oggi (l'unica intestazione telefono che ha spazio a destra: `:648-660`).

**Tutto il resto e fuori.** In particolare NON si toccano gli altri moduli, i temi, e
la sostanza della pagina Impostazioni. Se il compito sembra chiedere di piu, fermati e
dillo a Manuel.

## Le due trappole, gia identificate: leggile prima di progettare

1. **Il logout non e `signOut()`.** Sono cinque passi in fila
   (`settings-client.tsx:216-238`) e ognuno ha una cicatrice dietro: la cache del piano
   che restava "premium" addosso al browser dopo il logout, la scansione dell'archivio
   da dimenticare, il cookie della demo. Il menu nuovo ne ha bisogno. **Non copiarli**:
   estraili in `src/lib/auth/logout.ts` e chiamalo dai due punti. Il 23 agosto la stessa
   funzione e stata costruita due volte da due chat diverse: e la ragione per cui
   esistono i recinti, e qui il rischio si ripresenta identico.

2. **Il foglio dal basso esiste gia.** Vive nel modulo Oggi
   (`add-to-day.tsx:164-200`, CSS `.jm-sheet*` in `src/modules/oggi/styles.css:1534-1629`)
   e ha gia velo sfocato, maniglia, righe da 58px, `max-width: 440px` e il padding per
   la safe-area. **Non disegnarne un secondo**: promuovilo in `src/styles/base.css` con
   una primitiva `src/components/ui/sheet.tsx`, e fai passare `add-to-day.tsx` da li.
   Lo spostamento del CSS e coperto da un banco che esiste gia
   (`node scripts/verify-css-split.mjs`, che confronta gli stili CALCOLATI prima/dopo):
   se il foglio di Oggi cambia di un pixel, esce rosso. Se il tempo non basta per la
   promozione, riusa le classi esistenti cosi come sono e scrivilo nel commit; l'unica
   cosa vietata e duplicare quelle regole sotto un prefisso nuovo.

## La consegna in due tempi, che va detta e non nascosta

Sul telefono il pallino vive nell'intestazione delle schermate, e le intestazioni
appartengono ai moduli. Su Oggi c'e spazio e lo monti tu. Su **Mese** no: quel bordo
destro e gia occupato da frecce, contatore e interruttore lista/griglia
(`mese-client.tsx:286-345`), e un pallino piazzato li si sovrappone. Quindi:

- questa sessione consegna il pezzo funzionante e lo monta su Oggi;
- Mese, Ricorda, Recap e i moduli lo ricevono con una riga ciascuno, nelle loro
  sessioni. Lascia scritto in `HANDOVER.md` (o nel CLAUDE.md dei moduli interessati)
  che quella riga manca, cosi la sessione dopo non deve indovinarlo.

Fino ad allora, sul telefono, alle impostazioni si arriva da Oggi. E una consegna
parziale dichiarata, non un buco.

## Le regole che rompono tutto se le sbagli

- **Branch, mai main.** Crea `scheletro-porta-account` da `origin/main` e pusha SOLO
  quello. Il merge su main lo decide Manuel. Se il push risponde 403 "access denied by
  the git proxy", non e un permesso mancante: ripeti con
  `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY -u ALL_PROXY -u all_proxy git push origin <branch>`.
- **Controlla di essere aggiornato prima di partire.** `git fetch origin` e verifica che
  il tuo `main` non sia indietro: il 28 agosto una sessione ha trovato il main locale
  fermo di 29 commit e ha rischiato di disegnare su codice vecchio (nel frattempo il
  marchio era diventato dayalogue).
- **Solo token del tema** (`--color-*`, `--jm-*`), mai colori o misure a mano; ogni
  font-size e `calc(Npx * var(--jm-ui-scale))`; ogni testo a schermo passa da `t()` di
  `@/lib/i18n`.
- **git**: email `spamming.madh52@gmail.com`; `git add <file espliciti>`, mai `-A`;
  niente reset/rebase/stash/clean (merge ok); `git push --dry-run` prima del push.
- **Fermati a uno stato pulito.** Se il tempo finisce, committa un pezzo che funziona,
  non un refactor a meta.

## Prima di dichiarare finito

Nell'ordine, tutti verdi:

1. `npx tsc --noEmit && npx eslint .` — zero errori. I warning "Confine fra moduli"
   nuovi sono un errore tuo.
2. `node scripts/verify-i18n.mjs`
3. `node scripts/verify-css-split.mjs` — e la prova che il foglio di Oggi non e
   cambiato nello spostamento.
4. `node scripts/verify-impostazioni.mjs` e `node scripts/verify-lingua.mjs` — la
   pagina Impostazioni non deve essersi mossa.
5. `node scripts/verify-pr8.mjs` — le scorciatoie e il guscio desktop.
6. Il dev server serve per i banchi che aprono un browser: come si avvia in sandbox e
   scritto in `HANDOVER.md` §10.

Poi il banco nuovo, perche questo comportamento oggi non lo copre nessuno. Deve
verificare, nel browser, almeno: il menu si apre col click e col tocco; si chiude con
Esc, col click fuori e col tocco sul velo; il fuoco torna sul bottone; `aria-expanded`
segue lo stato; in modalita locale il menu mostra "Accedi al tuo account" e NON mostra
Premium ne Esci; dentro il guscio iOS l'etichetta e "Scopri Premium" e non compare
nessun prezzo; la barra del telefono non ha piu lo slot Impostazioni e mostra Ricorda
anche con un modulo acceso; il logout dal menu e quello dalle impostazioni fanno
esattamente gli stessi cinque passi.

**E poi PROVALO A MORDERE**: reintroduci il difetto (per esempio togli la chiamata a
`clearPlanCache` dal logout estratto, o rimetti la voce "Impostazioni" nella
navigazione), guarda il banco diventare rosso, ripristina. Un banco che non ha mai
fallito non e una guardia, e una decorazione.

Manuel legge le risposte in italiano. Non e un tecnico: quando gli parli, spiega le
scelte in parole semplici e — quando serve una decisione — UNA domanda per risposta,
con opzioni numerate. Sii onesto sul non-fatto: un "fatto" detto prima di aver
verificato nel browser e una bugia, non una cortesia.

---

## Come si e arrivati qui (per la sessione che trova strette queste istruzioni)

Il 28 agosto 2026 Manuel ha fatto notare che il pallino con la sua iniziale, in fondo
alla rail, non fa niente: `rail-left.tsx:185` e un `<div>` senza `onClick` e senza
`href`. Le impostazioni si aprivano da una voce di menu con tre puntini — il nome
"Altro" del vecchio cassetto e ancora nel codice, `key: "altro"` — e sul telefono da un
quinto slot etichettato "Impost." perche la parola intera sfonda i 390px.

Sono state disegnate tre strade (`design/mockups/impostazioni-dal-pallino.html`).
Manuel ha scelto **desktop B + iOS A, con il menu su tutte e due le superfici**:
il pallino apre un menu, popover sul computer e foglio dal basso sul telefono.

Il guadagno che ha deciso la scelta non e estetico: liberando il quinto slot della
barra, il modulo acceso non sfratta piu Ricorda, e il compromesso descritto in
`tab-bar.tsx:114-118` smette di servire.
