# Handover . Le aree diventano dati, e nasce il pannello admin

Scritto il 25 agosto 2026 da una chat worker (Opus) per la **sessione scheletro**
che prendera in mano questo lavoro. Manuel ha deciso che lo scheletro lo tocca una
chat Fable: quello che segue e tutto cio che serve per non rifare la ricognizione.

Chi legge questo file lo legge DOPO `ARCHITETTURA.md`, `AGENTS.md` e `WORKERS.md`,
non al loro posto.

---

## 0. Dove sono i file (per non perdere tempo a cercarli)

- **Repo GitHub:** `manuelvisuals/journal-me` (il prodotto adesso si chiama
  **Dayalogue**, il repo no: non e un errore).
- **Clone sul Mac di Manuel:** `/Users/manuel/Developer/journal-me`
  Non `~/Documents`, non `~/Desktop`. In `/Users/manuel/Documents/Claude/Projects/03 Journal.me`
  c'e una copia vecchia e scollegata: **non usarla**.
- **Dove lavori tu:** un clone fresco nel tuo sandbox, per esempio `/tmp/jm-work`.
  Ricetta che funziona (il filesystem montato e troppo lento per `npm install`):

```bash
cd /tmp && rm -rf jm-work jm-deps
git clone https://github.com/manuelvisuals/journal-me.git /tmp/jm-work
mkdir -p /tmp/jm-deps && cp /tmp/jm-work/package*.json /tmp/jm-deps/
cd /tmp/jm-deps && npm install --no-audit --no-fund
cp -a /tmp/jm-deps/node_modules/. /tmp/jm-work/node_modules/
cd /tmp/jm-work && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint .
```

Due trappole gia pagate: il repo ha un `node_modules` **parziale gia committato**
(servono a `Package.swift` del guscio iOS) quindi si copia DENTRO, non si fa un
symlink; e `npx tsc` non trova il binario, si chiama `./node_modules/.bin/tsc`.

**Tutti i percorsi in questo documento partono dalla radice del repo.**

---

## 1. Cosa si sta facendo, e perche

Le sei macro-aree in cui l'AI divide una giornata (Lavoro, Relazioni, Cibo,
Movimento, Corpo, Emozioni) sono un elenco chiuso **scritto nel codice in sette
punti**. Aggiungerne una li tocca tutti, quindi non se ne aggiunge mai.

Manuel ne vuole una nuova ("Passioni": canto, hobby, corsi presi per piacere) e
soprattutto vuole poterlo fare da solo. Da qui due lavori legati:

1. le aree diventano **dati** in una tabella, lette dal codice;
2. nasce **`dayalogue.com/admin`**, il pannello delle impostazioni globali, dove
   le aree sono la prima schermata.

Mockup approvato: `design/mockups/admin.html` (sul ramo `worker-admin-mockup`).

---

## 2. Cosa e GIA FATTO (verificato, non dedotto)

### La tabella esiste ed e popolata

`supabase/migrations/015_aree.sql` e **gia stata applicata** sul progetto Supabase
`fljshsmpmpzapcczsbwc`. Verificato interrogando il database, non gli appunti:

- 6 righe: `Lavoro, Relazioni, Cibo, Movimento, Corpo, Emozioni`
- `relrowsecurity = true`
- una sola policy: `aree: lettura pubblica` su `SELECT`
- **nessuna policy di scrittura**: si scrive solo dal service role

Colonne: `chiave` (pk), `nome`, `nome_en`, `cosa_ci_va`, `ordine`, `icona`,
`attiva`, `created_at`, `updated_at`.

Come si esegue SQL su questo progetto senza chiavi di servizio: dalla scheda del
dashboard Supabase gia loggata in Chrome, `POST` a
`https://api.supabase.com/v1/projects/fljshsmpmpzapcczsbwc/database/query` con
`Authorization: Bearer <token>` preso da `localStorage["supabase.dashboard.auth.token"]`.
Il pannello web non disegna niente quando Chrome e in secondo piano: questa strada
funziona lo stesso.

### Un contratto proposto, da giudicare

Sul ramo **`scheletro-aree-admin`** ci sono tre file nuovi. **Sono una proposta,
non un lavoro finito**: tienili, correggili o buttali.

- `src/lib/aree.ts` — il tipo `Area`, le sei aree cotte dentro come rete di
  sicurezza, `nomeArea`, `nomeDaChiave`, `areeAttive`, `areaDaRiga`, `urlAree`
- `src/lib/server/aree.ts` — `leggiAree()`: fetch REST, cache in memoria un
  minuto, ripiego sull'elenco cotto se il database non risponde
- `src/lib/aree-client.ts` — `useAree()`: `useSyncExternalStore`, copia in
  `localStorage["jm.aree"]`, **non tocca la rete in modalita locale**

`tsc` e pulito con questi file dentro. Il modulo `oggi` NON e stato toccato: legge
ancora l'elenco scritto a mano.

---

## 3. Le decisioni gia prese con Manuel (non riaprirle senza motivo)

1. **`chiave` e `nome` sono due cose diverse, ed e il punto di tutto il lavoro.**
   Dentro ogni giornata gia salvata (`entries.areas`, jsonb senza vincoli) c'e
   scritta la parola `"Lavoro"`: finora il nome visibile era anche l'identita,
   quindi rinominare un'area avrebbe scollegato tutto lo storico. Per questo le sei
   chiavi di partenza sono **esattamente** le etichette maiuscole di sempre: cosi
   non si riscrive nemmeno una riga di storico. Le aree nuove prendono per chiave
   il nome del giorno in cui nascono, e da li quella chiave e ferma.
2. **Il contratto sta nello SCHELETRO, non nel modulo `admin`.** Le aree le scrive
   il pannello ma le leggono `oggi` e `recap`. Se vivessero in `modules/admin`,
   `oggi` dovrebbe importare da li: l'app dipenderebbe dal suo pannello di
   controllo. Il pannello si puo spegnere, il diario no.
3. **Si spegne, non si cancella.** Cancellare lascerebbe le giornate vecchie con
   un'etichetta che non esiste piu.
4. **`cosa_ci_va` finisce nelle istruzioni del modello, parola per parola.** Oggi
   quelle frasi sono sepolte nel prompt; il valore di portarle qui e poterle
   correggere la sera stessa in cui l'AI sbaglia.
5. **L'ordine e una proprieta dell'area**, non della schermata: oggi c'e un secondo
   elenco solo per l'ordine, e due liste che devono restare d'accordo prima o poi
   litigano.
6. **Admin = `madh52@gmail.com`**, uno solo. Il controllo va server-side, accanto a
   `src/lib/server/entitlement.ts`, che e gia il posto dove si decide chi puo fare
   cosa. Le scritture passano dal service role (`getAdminClient()` in quel file).

---

## 4. I sette punti da cui togliere l'elenco

Percorsi dalla radice del repo. Questa e la ricognizione fatta a mano il 25 agosto:
se trovi un ottavo punto, aggiungilo qui.

| File | Cosa c'e dentro |
|---|---|
| `src/modules/oggi/server/process-entry.ts` | l'`enum` delle sei etichette nello schema JSON (righe ~40-47); la frase del prompt che le rielenca (~riga 154); le tre righe "Cosa va in quale area" (~157-160); e **una seconda chiamata di riserva** che rielenca tutto quando il modello non trova nessuna area (~riga 288). Sono quattro posti nello stesso file. |
| `src/modules/oggi/server/chiarimenti.ts` | `const AREE` (riga ~42) e il prompt che lo interpola (riga ~225) |
| `src/modules/oggi/components/filled-view.tsx` | `AREA_ORDER` (riga ~246): l'ordine di lettura |
| `src/modules/oggi/components/area-icon.tsx` | la mappa dei disegni: **cinque su sei**, Corpo non ha icona ed e voluto. Va rifatta a chiave sul campo `icona`, non sul nome |
| `src/modules/oggi/en.ts` | `"Lavoro"`, `"Relazioni"`, `"Emozioni"`, `"Movimento"` |
| `src/lib/i18n/catalogs/comune.ts` | `"Corpo"`, `"Cibo"` |
| `scripts/verify-aree.mjs` e `scripts/verify-i18n.mjs` | la guardia legge il sorgente e cerca le sei stringhe; `verify-i18n` ha una **whitelist** (riga ~77) che permette a quelle etichette di non passare da `t()` |

**Falso positivo da non correggere:** in
`src/modules/oggi/components/chiarimenti-screen.tsx` (riga ~336) c'e `t("Lavoro")`,
ma li "lavoro" e il TIPO di una cosa ("una persona", "un posto", "lavoro"), non
l'area. Va lasciato dov'e.

Nota sulle traduzioni: se il nome visibile viene dal database (`nome` / `nome_en`),
le etichette **escono da `t()`** e quelle voci vanno tolte dai due cataloghi e
dalla whitelist di `verify-i18n`. E una semplificazione, ma tocca file condivisi.

---

## 5. Il modulo nuovo, e i quattro punti dove va dichiarato

`ARCHITETTURA.md` (riga ~116) dice gia: *"Il modulo `admin` (allowance per tier,
solo master) e futuro e nascera gia in questa forma"*. Prefisso CSS: `jm-adm`.

Forma del passo D:

```
src/modules/admin/CLAUDE.md
src/modules/admin/index.ts          la porta
src/modules/admin/components/       le schermate
src/modules/admin/styles.css        prefisso jm-adm
src/modules/admin/en.ts             il catalogo inglese
src/modules/admin/server.ts         la logica delle rotte
src/app/admin/page.tsx              guscio
src/app/api/admin/aree/route.ts     guscio di 10 righe
```

Un modulo nuovo non esiste finche non e dichiarato in **quattro** posti condivisi.
Sono i file su cui due chat in parallelo si scontrano: e il motivo per cui questo
lavoro si fa da soli.

1. `eslint.config.mjs` — l'array `MODULES` (riga ~12). Il lint dei confini e a
   **ERRORE**: senza questa riga il modulo non ha recinto.
2. `src/app/globals.css` — l'`@import "../modules/admin/styles.css"` fra gli altri.
   **L'ordine e parte del contratto**: `base.css` prima dei moduli, `overrides.css`
   dopo. Un `@import` messo dopo le regole viene ignorato dal browser senza dare
   nessun errore.
3. `src/lib/i18n/en.ts` — import di `ADMIN` e la riga `...ADMIN` nell'unione.
4. `ARCHITETTURA.md` — la riga che oggi dice che `admin` e futuro.

Piu il `CLAUDE.md` del modulo, che e il recinto scritto per la chat che verra dopo.

---

## 6. Trappole di questo progetto che qui mordono

- **La modalita locale non fa NEMMENO UNA richiesta di rete.** E la promessa piu
  importante dell'app (SPEC-v2 §1) e ha un banco che la controlla
  (`scripts/verify-pr10.mjs`). Le aree, in locale, devono venire dall'elenco cotto
  nel pacchetto. Conseguenza da dire a Manuel e non nascondere: **chi usa il
  telefono in modalita locale non vedra le aree nuove finche non si ricostruisce
  il pacchetto iOS.**
- **Il guscio iOS e un export statico** dentro il binario: nessun server, nessuna
  route handler. Tutto cio che serve al primo disegno deve essere nel pacchetto.
- **Le `NEXT_PUBLIC_*` sono compilate dentro** `ios/App/App/public`.
- **`ios/App/App/public` e generato ma versionato**: ricostruirlo sporca file che
  il pull vuole aggiornare. Lo script `aggiorna-e-apri-xcode.command` in radice li
  butta prima di tirare.
- **Non dichiarare risolto senza aver visto**: e una regola scritta di Manuel, e
  qui vale doppio perche il pezzo piu fragile (il prompt del modello) non lo
  verifica nessun `tsc`.

---

## 7. Come si verifica che sia fatto davvero

`tsc` ed `eslint` puliti non dimostrano niente su questa roba. Le prove:

1. `node scripts/verify-aree.mjs`, `node scripts/verify-i18n.mjs` verdi **dopo**
   averli aggiornati (aggiornarli e parte del lavoro, non un extra).
2. Dal pannello si aggiunge **Passioni**, e la si ritrova in una giornata
   raccontata subito dopo: e la prova che il prompt legge davvero dal database.
3. Si spegne un'area e sparisce dalle scelte del modello, **ma le giornate vecchie
   che la contengono continuano a mostrarla**.
4. Si rinomina un'area (solo il `nome`) e lo storico non si scollega: e la prova
   che chiave e nome sono davvero separati.
5. Modalita locale: nessuna richiesta di rete (il banco esistente).
6. `/admin` aperto da un account che non e `madh52@gmail.com` non deve mostrare
   niente, e la rotta di scrittura deve rispondere di no anche se chiamata a mano.

---

## 8. Regole operative (le stesse di sempre)

- Branch, mai `main`. Su `main` si arriva per merge, lo decide Manuel.
- Email autore dei commit: `spamming.madh52@gmail.com`.
- `git add <file espliciti>`, mai `-A`. Niente `reset --hard`, `stash`, `rebase`,
  `clean` sui file di lavoro.
- Se il push risponde 403 "access denied by the git proxy", non e un permesso
  mancante: ripeti con
  `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY -u ALL_PROXY -u all_proxy git push origin <branch>`
- Niente emoji in codice, commit, config o markdown.
- Apostrofi ASCII, mai quelli tipografici: c'e un test che li rifiuta.
- Manuel non e un tecnico: spiegazioni in parole semplici, **una domanda per
  risposta** con opzioni numerate, e una sezione finale "In parole povere".
- **Mentre questo lavoro e in corso, nessun'altra chat deve scrivere in
  `src/lib/`, `eslint.config.mjs`, `src/app/globals.css`, `src/lib/i18n/en.ts`.**

---

## 9. L'ordine consigliato

Manuel ha gia scelto: **prima lo scheletro, poi il pannello.**

1. Giudicare i tre file su `scheletro-aree-admin` e chiuderne la forma.
2. `oggi` legge dal contratto: prima il server (prompt e chiarimenti), poi la
   schermata (ordine, nomi, icone). Guardie aggiornate.
3. Merge e verifica che l'app si comporti **esattamente come prima**: a questo
   punto non deve essere cambiato niente di visibile. E il momento di rischio piu
   alto e insieme quello piu facile da controllare.
4. Il modulo `admin` e la schermata Aree.
5. Aggiungere Passioni dal pannello, e vederla in una giornata vera.
