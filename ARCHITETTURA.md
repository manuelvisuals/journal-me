# dayalogue — scheletro e moduli

Richiesta di Manuel: una struttura fissa (scheletro) piu moduli indipendenti, cosi ogni
chat lavora su un modulo solo senza rompere il resto, anche quando l'app diventa
gigantesca. Obiettivo finale: app iOS su App Store, premium, qualita alta, revisione
Apple senza sorprese.

**Approvato da Manuel il 23 agosto 2026** (opzione: partire dal passo A). Stato:

- passo A — FATTO il 23 agosto: questa mappa, un CLAUDE.md di recinto in ogni cartella
  di modulo, la regola ESLint sui confini in modalita warning, WORKERS.md vincolante,
  PROMPT-WORKER.md per aprire chat nuove.
- passo B — FATTO il 23 agosto: globals.css (5.092 righe) e diventato l'indice degli
  import; il CSS vive in src/styles/ (base, un file per modulo, overrides). La guardia
  degli stili calcolati (scripts/verify-css-split.mjs) ha certificato 18/18 scatti
  identici prima/dopo, e tutte le 21 suite sono verdi. L'ordine degli import e parte
  del contratto: base prima dei moduli, overrides dopo.
- passo C — FATTO il 23 agosto: en.ts (521 voci) e diventato l'unione di
  src/lib/i18n/catalogs/<modulo>.ts (9 cataloghi, divisi per uso misurato della
  frase; le condivise in comune.ts). en-extra.ts e svuotato e resta come innesto
  d'emergenza. verify-i18n ora legge i cataloghi e ha un controllo nuovo, provato
  a mordere: una chiave definita in due cataloghi e un rosso.
- passo D — FATTO il 23 agosto: i moduli vivono in src/modules/<nome>/ (components,
  styles.css, en.ts, index.ts la porta, CLAUDE.md il recinto). I tre pezzi condivisi
  passano dalle porte: RecordingOverlay (oggi), QuickCapture (ricorda), il muro
  premium (abbonamento, il piu importato). Il lint dei confini e a ERRORE: l'interno
  di un modulo altrui non si importa piu, e zero warning residui.
- passo E — FATTO il 23 agosto: la logica delle 11 route API vive in
  src/modules/<nome>/server/ (oggi 5, abbonamento 3, recap/ricorda/impostazioni 1);
  le route in app/api sono gusci di poche righe che ri-esportano gli handler (i
  segment config, tipo runtime/maxDuration, restano letterali nel guscio perche
  Next li vuole li).
- passo F — FATTO il 23 agosto: i documenti seguono i moduli (SPEC-fatti,
  SPEC-fatti-decisioni, RISULTATI-prova-modelli e il referto del bug registrazione in
  modules/oggi; HANDOVER-consumi in modules/impostazioni; BRIEF-checkout-finto in
  modules/abbonamento), i chiusi stanno in docs/storia/ (audit, PROMPT-sorella), e
  HANDOVER.md e dichiarato NON crescente: lo stato di un modulo vive nel suo CLAUDE.md.

**Chi apre una sessione su questo repo legge questo file PRIMA di toccare codice**, poi
il CLAUDE.md della cartella in cui lavora. Se lavori a un modulo, il tuo perimetro e
scritto li; se un compito ti chiede di uscire dal perimetro, fermati e dillo a Manuel.

---

## 1. Cosa dice il codice oggi (misurato, non dedotto)

Numeri presi dal repo al commit 15d9cf8:

- ~26.000 righe fra TS/TSX/CSS. I file piu grandi: `globals.css` 5.092 righe,
  `recording-overlay.tsx` 982, `store/cloud.ts` 955, `today-client.tsx` 855.
- I file piu toccati negli ultimi 60 commit: `globals.css` (11 volte), `en.ts` (10),
  `today-client.tsx` (7), `features.css` (7), `settings-client.tsx` (6). Sono ESATTAMENTE
  i file dove le sessioni parallele si scontrano: in questa sessione ho risolto a mano
  tre conflitti, tutti su `globals.css`, `en.ts` e `settings-client.tsx`, e due
  risoluzioni automatiche avevano CORROTTO il CSS (regole di una sessione iniettate
  dentro le graffe dell'altra).
- La modularita in realta c'e gia a meta: un folder per schermata in `components/`
  (today, mese, remember, settings, consumi, persona, aree, recap, day), una route API
  per funzione AI in `app/api/`, un contratto unico per i dati (`JournalStore` in
  `lib/data/store/types.ts` con le due implementazioni local/cloud), un contratto per i
  temi, un catalogo i18n con verifica automatica.
- Gli import fra schermate sono pochi e sani: `day` riusa l'editor di `today`,
  `settings` monta `consumi`, `remember` riusa una pill di `today`. Il grosso degli
  import va verso `lib/` (i18n 60 volte, types 39, format 27, store 25).
- Esistono gia due "punti d'innesto" anti-conflitto inventati dalla sessione parallela:
  `features.css` (importato in cima a globals.css) e `en-extra.ts` (consultato da t()
  prima del catalogo grande), piu il protocollo `WORKERS.md`.

Diagnosi: il problema NON e la mancanza di cartelle per schermata. E che quattro file
condivisi (`globals.css`, `en.ts`, `settings-client.tsx`, e in misura minore
`today-client.tsx`) fanno da imbuto: qualunque modulo tocchi, finisci per scrivere li,
e li si scontrano le chat. `features.css`/`en-extra.ts` sono la pezza giusta ma
temporanea: sono UN file extra condiviso da tutti i rami, quindi l'imbuto si e solo
spostato.

## 2. La struttura proposta

Due categorie di file, dichiarate per iscritto e fatte rispettare da guardie
automatiche, non dalla buona volonta.

### Lo SCHELETRO (si tocca solo in una sessione dedicata, mai da un modulo)

```
src/lib/            types, i18n (runtime), format, api, capabilities, plan, pricing,
                    data/store (contratto + local + cloud), server/ (entitlement, ai-usage)
src/themes/         contratto token + temi
src/components/ui/  primitive condivise (tab-bar, toast, righe di lista)
src/components/desktop/  guscio desktop (shell, palette, rail, focus)
src/app/layout.tsx  e le pagine-wrapper (sono gia sottili: 35-88 righe)
src/styles/base.css tokens, reset, primitive condivise (oggi: la prima parte di globals)
```

Regola: un modulo USA lo scheletro, non lo modifica. Se un modulo ha bisogno di una
primitiva nuova, la chiede (una sessione scheletro la aggiunge) o la tiene nel proprio
folder finche non e matura.

### I MODULI (uno per chat, un folder ciascuno)

```
src/modules/<nome>/
  CLAUDE.md         il recinto: cosa e il modulo, quali file possiede, il suo prefisso
                    CSS, come si verifica, cosa NON deve toccare
  index.ts          l'unica porta: cio che gli altri possono importare
  components/       le schermate e i pezzi del modulo
  styles.css        TUTTO il CSS del modulo, col suo prefisso (es. jm-cs-*)
  en.ts             le sue traduzioni (unite dal runtime i18n)
  server.ts         (se ha API) la logica; la route in app/api resta un guscio di 10 righe
```

I moduli, ricalcando i confini che il codice ha gia:

Dal passo D questa struttura E la realta: `src/modules/{oggi, mese, ricorda,
recap, impostazioni, accesso, abbonamento, palestra}`. I prefissi CSS veri di
ogni modulo sono nel suo CLAUDE.md (misurati, non a memoria). Le pagine di
`src/app/` restano dove Next le vuole e sono gusci; ognuna appartiene a un
modulo (elencato nel CLAUDE.md del modulo). Il modulo `admin` (allowance per
tier, solo master) e futuro e nascera gia in questa forma.

### Le guardie (cio che rende la struttura vera invece che decorativa)

1. **CSS senza piu imbuto.** `globals.css` si riduce a tokens + `@import` dei file
   modulo. Una guardia (`scripts/verify-confini.mjs`) controlla che ogni `styles.css`
   usi solo i prefissi del suo modulo: se la chat di Mese scrive una regola `jm-st-*`,
   il banco esce rosso. La guardia va provata a mordere prima di fidarsi (dottrina
   Stoqfolio: reintrodurre il difetto, vedere il rosso, ripristinare).
2. **Traduzioni senza piu imbuto.** `en.ts` diventa l'unione dei cataloghi dei moduli;
   `verify-i18n.mjs` (esiste gia, 6 controlli) impara a segnalare chiavi duplicate fra
   cataloghi. `en-extra.ts` muore: era la pezza per non avere questa struttura.
3. **Confini di import.** Regola ESLint (`no-restricted-imports`), a ERRORE dal
   passo D: un modulo importa lo scheletro e se stesso; di un altro modulo puo
   importare SOLO la porta (`import ... from "@/modules/<nome>"`). Le porte vive:
   RecordingOverlay (oggi), QuickCapture (ricorda), il muro premium (abbonamento).
4. **Un CLAUDE.md per modulo.** Claude legge automaticamente il CLAUDE.md della cartella
   in cui lavora: e il posto dove il recinto e scritto PER la chat, non per l'umano.
   Il CLAUDE.md di root resta corto e rimanda: mappa dei moduli + regole dello scheletro.
5. **Verifica per modulo.** Le suite esistono gia quasi tutte (21 banchi verdi oggi);
   si mappano: `npm run verify oggi`, `npm run verify impostazioni`, `npm run verify:all`.
   Una chat che chiude un modulo fa girare il SUO banco piu `verify-confini` piu
   tsc/eslint: non serve piu sapere quali altri banchi esistono.
6. **Git come da WORKERS.md**, che va promosso da consiglio a regola: un modulo = un
   branch = una chat; su `main` si arriva per merge. Oggi le sessioni pushano tutte su
   main e i merge incrociati li paga chi arriva secondo (stanotte: tre fetch-merge-push
   prima di riuscire a passare).

## 3. Il piano, in ordine di sicurezza (uno step = un branch = una verifica)

**A. La mappa e i recinti (zero codice spostato). FATTO il 23 agosto 2026.**
`PIANO-ARCHITETTURA.md` e diventato `ARCHITETTURA.md` (la mappa), ogni cartella di
modulo ha il suo CLAUDE.md (per ora puntano ai path attuali), la regola ESLint sui
confini e in modalita WARNING (fotografa gli attraversamenti senza rompere nessuno),
WORKERS.md e vincolante. Da adesso ogni chat sa il suo recinto.

**B. Lo spacchettamento del CSS (il passo che vale di piu). FATTO il 23 agosto 2026.**
`globals.css` 5.092 righe → `styles/base.css` + un file per modulo, `@import` in cima.
Meccanico ma delicato: la prova e un banco che confronta gli stili CALCOLATI di ogni
schermata prima/dopo (stessa dottrina delle misure di Stoqfolio: si misura il rendering,
non si guarda il diff). Le 24 sezioni commentate del file dicono gia dove tagliare.
⚠️ Da fare in una finestra in cui NESSUN'ALTRA sessione scrive CSS, o il merge sara
sanguinoso: e il passo da coordinare con te.

**C. Lo spacchettamento delle traduzioni. FATTO il 23 agosto 2026.**
`en.ts` 490 righe → un catalogo per modulo + unione nel runtime; `en-extra.ts` si
riassorbe. La guardia c'e gia (verify-i18n) e si estende ai duplicati. Stesso avviso
di coordinamento del punto B, ma il file e piu piccolo e il merge meno pericoloso.

**D. Lo spostamento dei folder in `src/modules/`. FATTO il 23 agosto 2026.**
Il rename grosso (components/today → modules/oggi/components, ecc.), `index.ts` per
modulo, ESLint da warning a ERRORE. E il passo piu rumoroso nel git (ogni file cambia
path) e va fatto per ultimo, a B e C digeriti, in una finestra tranquilla.

**E. Le route API diventano gusci. FATTO il 23 agosto 2026.**
La logica delle 8 route scende in `modules/<nome>/server.ts`. Facoltativo e senza
fretta: le route sono gia piccole (68-268 righe) e ben separate.

**F. I documenti seguono i moduli. FATTO il 23 agosto 2026.**
HANDOVER.md resta la storia generale ma smette di crescere: lo stato di un modulo vive
nel suo CLAUDE.md. (Oggi in root ci sono 14 documenti .md: la meta e roba di moduli.)

## 4. Cosa NON cambia

- Le pagine di `app/` restano dove sono: e Next a volere quel layout, e sono gia gusci.
- Il contratto `JournalStore` non si tocca: e gia il confine giusto fra schermate e dati,
  ed e il motivo per cui "in locale nemmeno una richiesta di rete" e verificabile.
- I banchi di verifica esistenti restano tutti: cambiano solo indirizzo (per modulo).
- Niente monorepo, niente workspace npm, niente librerie di enforcement pesanti: la
  taglia del progetto non le giustifica, e ogni attrezzo in piu e una cosa che le chat
  future devono imparare.

## 5. La nota App Store (va decisa, non oggi ma presto)

Il guscio Capacitor c'e (`npm run build:ios`). Per la revisione Apple il punto delicato
non e la struttura del codice (ad Apple non importa): e che un abbonamento digitale
venduto DENTRO l'app iOS deve passare da In-App Purchase o dalle deroghe post-2025 sui
link esterni, non da un checkout Stripe dentro la webview. Il modulo `abbonamento`
proposto sopra e il posto dove questa differenza vivra (su web Stripe, su iOS IAP o
niente bottone): tenerlo in un modulo solo e cio che rendera quella modifica piccola.
