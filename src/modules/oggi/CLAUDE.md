# Modulo OGGI

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

La giornata: racconto a voce/scritto, editor, overlay di registrazione,
giornata raccontata (FilledView), metriche, obiettivi, chiarimenti, e la
schermata /giorno di una data scelta. Pagine che lo montano:
`src/app/(app)/app/page.tsx` e `src/app/(app)/app/giorno/`.

Cambiare giorno (29 agosto 2026, mockup `design/mockups/navigazione-giorno.html`,
variante A): `day-nav.tsx` e la testata con le frecce (due piani: "Oggi",
"Ieri", "Mercoledi" sopra, la data sotto; il centro apre
`date-picker-popover.tsx`), `day-swipe.tsx` e lo stesso cambio col dito.
LA REGOLA: il passato si sfoglia senza fondo, il futuro no — su oggi la
freccia avanti e spenta, il dito rimbalza e una riga lo spiega. Mentre il
dito va di lato la pagina si FERMA (no allo scorrimento sul touchmove piu
una rete di sicurezza che la riporta alla sua altezza): senza, la giornata
scivolava anche su e giu e il gesto sembrava scivoloso. Su /giorno
si sfoglia SENZA cambiare pagina (i due vicini si leggono in anticipo e
l'indirizzo si aggiorna con replaceState); arrivare a oggi porta a "/",
che e la casa di oggi. Da Oggi si va a ieri con un cambio di schermata:
quella schermata sa fare una data sola, e farle cambiare data vorrebbe
dire riscrivere l'editor e la registrazione.

- Prefissi CSS (misurati): `jm-ed`, `jm-editor`, `jm-fv`, `jm-rec`, `jm-day`
  (compresi i nuovi `jm-day-nav-*` e `jm-day-sw-*`),
  `jm-area`, `jm-metric`, `jm-stepper`, `jm-rm`, `jm-goal*`, `jm-write`,
  `jm-add`, `jm-ptt`, `jm-ch`, `jm-foto`. In dubbio: grep nei componenti.
- La porta esporta RecordingOverlay (lo usa Ricorda per la cattura a voce).
- Orchestrazione del salvataggio: `src/lib/actions/save-recording.ts`
  (scheletro: si cambia solo d'accordo con Manuel).
I chiarimenti (31 agosto 2026, mockup `design/mockups/chiarimenti-multi.html`):
una domanda sulle PERSONE accetta piu risposte — "i miei amici" possono
essere Hoda e Liana, e sceglierne una sola era far scrivere al diario una
cosa falsa. La casella davanti alla risposta e quadrata quando se ne puo
prendere piu di una e tonda quando no: e l'unico segnale che arriva prima
del tocco. Le risposte che dicono il contrario ("non e una persona", "non
c'entra con nessuna sfera") spengono le altre. Sotto ci sta lo scheletro:
`Alias.labelKeys` e un ELENCO, e i due nomi stanno nella stessa casella
`label_key` separati da U+001F — nessuna migrazione, le righe vecchie si
leggono come un elenco di uno.
L'estratto del racconto c'e SEMPRE: `citazione.ts` lo ritaglia dal testo
quando il modello lo lascia vuoto (o quando scrive una frase che nel
racconto non c'e, cioe se l'e inventata), e la schermata va a riprendere il
racconto della giornata per le domande vecchie in coda. Il codice non
inventa mai: copia.

Le foto dal rullino (1 settembre 2026, mockup `design/mockups/foto-rullino.html`):
un giorno puo avere le sue foto, legate alla DATA e non al racconto (un
giorno senza parole le tiene lo stesso, e cancellare il racconto non le
tocca). Si entra dalla riga "Aggiungi dal rullino" del foglio di AddToDay
(schermata di scelta di sistema, mai una nostra). Al momento della scelta
`foto.ts` prepara DUE copie: miniatura ~480px (quella che la giornata
mostra, striscia `FotoGiorno` sotto il racconto) e copia da schermo
~2048px (viaggia solo aprendo il visore; nell'attesa si vede la miniatura
ingrandita, mai un buco). In locale stanno in IndexedDB in un database
TUTTO LORO (`journalme-foto`): il database `journalme` e scheletro e un
modulo non gli alza la versione. In cloud: tabella `entry_photos` +
bucket privato `foto` (migration 020), client Supabase a import dinamico
(un build solo-locale non lo costruisce). ATTENZIONE: il backup
export/import (scheletro) NON include ancora le foto — e scritto anche
nella nota di consegna, non dimenticarlo quando si tocca il backup.

- Banchi prima del push: `verify-cassaforte` (R6 R7 R8 R12: la giornata esce
  chiusa a chiave, il conflitto di versione, il dispositivo nuovo),
  `verify-rete-spenta` (R11: senza rete la trascrizione
  mostra un messaggio, mai un'attesa infinita), `verify-foto`, `verify-chiarimenti`, `verify-chiarimenti-vivo`,
  `verify-pr7`, `verify-testo-giorno`, `verify-aree`,
  `verify-icone-aree`, `verify-titolo-vivo`, `verify-titolo-luoghi`,
  `verify-giornata-larghezze`, `verify-analisi-testo-re`,
  `verify-nav-giorno`, `verify-barra-alto` (piu tsc, eslint,
  verify-i18n).
  Attenzione: `verify-icone-aree` e `verify-giornata-larghezze` hanno la
  porta 3200 scritta dentro, gli altri usano la 3100 (JM_BASE).
- Le API del modulo (passo E): `src/modules/oggi/server/` — chiarimenti,
  process-entry, extract-facts, split-by-date, transcribe-fallback. Le route in
  `src/app/api/` sono gusci e non si toccano.

La barra in alto (30 agosto 2026, scheletro): il nome della schermata e il
pallino dell'account NON stanno piu nell'intestazione di questo modulo, ma
in `src/components/ui/app-bar.tsx`, montata una volta sola dal guscio. Non
rimontare `AccountMenu` qui: `verify-barra-alto` diventa rosso.

## Il sipario del dock (1 settembre 2026, sera)

Ogni superficie a schermo pieno di questo modulo (chiarimenti, people
review, registrazione, review, scrittura sul telefono, visore foto) monta
`useRitiraDock()` (`src/components/ui/dock-sipario.ts`, scheletro): finche
e aperta IL DOCK NON ESISTE. Non e cosmesi: nel guscio iOS la pillola e
una lastra nativa SOPRA la WebView, nessuno z-index puo coprirla, e i
tasti in fondo ai chiarimenti finivano dietro il vetro. Una superficie a
schermo pieno nuova DEVE montare lo stesso hook. Banco:
`verify-bugfix-20260901` (elenco delle superfici cablate, morso incluso).

## Le testate sul metro di Month (1 settembre 2026, sera)

Mockup approvato: `design/mockups/testate-oggi-giornata.html`. Sul
telefono i comandi di Oggi (matita = modifica, foglio con la penna =
scrivi, microfono) e di /giorno (indietro, matita, cestino) vivono nella
BARRA IN ALTO via `AppBarAzione` / `AppBarPrima` (scheletro, app-bar.tsx),
come cerchi `.jm-cmd` da 38 col filo. Sotto la barra resta solo
`day-nav`, ridisegnata sul metro di `.jm-month-header.nav`: colonne
38 | 1fr | 38, padding 16/24/12, riga 66-67px, nome in serif anche su
Oggi (il doppione con la barra e il prezzo dichiarato della coerenza,
scelta di Manuel). La freccia verso domani sparisce ma la sua colonna
resta. Le vecchie intestazioni (`jm-col-head` di Oggi, `jm-day-head-riga`)
sono SOLO desktop (`jm-solo-desktop`). Tutto il ridisegno telefono sta in
un blocco `@media (max-width: 1023px)` in styles.css: da lg niente cambia.

## L'attesa dell'elaborazione e le foto senza salto (2 settembre 2026)

Mockup `design/mockups/attesa-elaborazione.html`. La rotella muta di
today-client e diventata `components/attesa-elaborazione.tsx`: un anello
che si svuota in 45 s (ATTESA_PREVISTA) coi secondi al centro, tre passi
che sono EVENTI del codice — "lettura" fino a `onAnalisi` di
save-recording.ts (scheletro), "salvataggio" fino al ritorno di
saveRecording, "dubbi" fino ai chiarimenti — e una riga onesta che a zero
cambia frase invece di mentire. Prefisso CSS `jm-attesa`. Le tre frasi dei
passi passano da t() come variabile: stanno nell'elenco DINAMICHE di
verify-i18n. Monta useRitiraDock (e a schermo pieno).

Sotto: misurato sul sito vero, split 3,6 s + analisi ~10 s + chiarimenti
16-21 s, prima tutti in fila. Ora lo split e l'analisi del caso "un
giorno solo" partono insieme (save-recording.ts: la scommessa vale se lo
split conferma un segmento con la data e le parole di partenza — e il
server split-by-date, con un segmento solo, restituisce le PAROLE
ORIGINALI), e i chiarimenti partono da `onAnalisi`, prima delle scritture.
Il grosso che resta e il modello dei chiarimenti: si cambia solo con una
prova misurata, non a sentimento.

Le foto del giorno (`foto.ts`, `fotoAttese`): a ogni elenco letto si
annota in localStorage quante foto aveva il giorno, e la striscia si
disegna subito con altrettante caselle `.jm-foto-attesa` (80px come le
miniature) finche l'elenco non arriva. Niente salto della giornata sotto.
La prima visita in assoluto a un giorno con foto resta senza promessa.

Il visore delle foto (2 settembre 2026, screenshot di Manuel: visore
sotto la barra, foto fuori dallo schermo) sta sul BODY via createPortal:
`.jm-day-sw-piano` ha `will-change: transform`, e un elemento con
transform diventa il riferimento di ogni `position: fixed` al suo interno
— "inset: 0" voleva dire il piano, non lo schermo. Regola da tenere: una
superficie fixed nata dentro il piano dei giorni va portata fuori col
portal. Il visore ha `touch-action: none` (il dito scorre le FOTO, la
pagina non si muove), lo swipe segue il dito e scatta oltre 72px; i tocchi
non risalgono al gesto dei giorni. Banco: `verify-foto` (28 controlli,
con tocchi sintetici via CDP).

## Una giornata sola (2 settembre 2026, passo 1)

Mockup `design/mockups/una-giornata-sola.html` (con il controaudit, 5 bis)
e l'interattivo `una-giornata-prima-dopo.html`, approvati da Manuel. Tre
volti della stessa cosa (Talk, Today, The day) sono diventati UNO:

- La barra dice il POSTO, "Diario", sia su /app sia su /app/giorno
  (app-bar.tsx, scheletro); il tab del dock e la rail dicono "Diario". Il
  QUANDO lo dice solo il nav sotto (Oggi, Ieri, giovedi 27).
- Lo stato vuoto e uno: `EmptyState` con `date` (la domanda cambia solo la
  data: "Com'e andato giovedi 27?") e `fotoSlot` (le foto del giorno anche
  senza parole). day-client lo monta al posto di "Non hai raccontato questo
  giorno"; i due tasti aprono l'atto sul giorno della schermata attraverso
  `AddToDay variant="muto"` (nessun tasto suo, solo i segnali
  apriScritturaSegnale / apriVoceSegnale / apriSegnale). Il + nella barra
  apre il foglio (rullino, Memo) anche sul giorno vuoto, su Oggi e su
  /giorno.
- La pagina "Racconta" (view "scelta", titolo forzato, pillola, Annulla)
  NON esiste piu: `?record=1` apre l'ascolto sopra la Giornata di oggi.
- Il giorno si sceglie DENTRO l'atto: la chip della data sta nell'ascolto
  (gia c'era) e in `ManualWrite` (prop `onTargetDateChange`; senza prop la
  chip non compare, perche l'aggiunta a una giornata ha gia la sua data).

Le due rotte restano (passo 2, fonderle davvero, quando conviene): il
metro e che a occhio non si distinguono. Banchi toccati: verify-testo-
giorno, verify-foto, verify-barra-alto, verify-nav-giorno, verify-sito.

## Il buco della rete (3 settembre 2026, SPEC ospite-e-cassaforte R11)

Senza rete, dopo Fine, la trascrizione restava su "Trascrivo..." per sempre:
la lettura del glossario da Supabase, davanti alla chiamata, non aveva tetto.
Chiuso dalla sessione scheletro `scheletro-rete-tetto`: tetti in
`src/lib/tetto.ts`, client Supabase con `fetchConTetto` (30 s su ogni
richiesta), `apiFetch` col cronometro prima del gettone. In questo modulo:
`GLOSSARIO_TETTO_MS` (4 s, poi si trascrive senza), `TRASCRIZIONE_TETTO_MS`
(120 s sull'intera operazione), `clipRef` (Fine dopo un errore riprova con lo
stesso audio). REGOLA da tenere: ogni attesa che precede una chiamata con
tetto deve avere un tetto anche lei, o il tetto non serve. Referto e prova a
mordere in `PROVA-trascrizione.md`.

## La giornata modificata altrove (3 settembre 2026, SPEC R7)

`components/conflitto-giornata.tsx` (prefisso `jm-conflitto`, mockup
`design/mockups/codice-di-recupero.html` 03): il foglio con le DUE versioni
quando il server rifiuta una scrittura perche la versione non e piu quella
corrente. Montato UNA volta dal guscio (via la porta), si apre da solo: le
cassettine (`src/lib/data/store/cassettine.ts`, scheletro) avvisano ogni
conflitto con `suConflitto`, da qualunque schermata. Tre tasti, nessuna
scelta automatica: tieni quella, tieni questa, tutte e due (l'altra finisce
in fondo al racconto sotto `--- dall'altra versione ---`). Le frasi diverse
sono evidenziate. Banco: `verify-cassaforte` (sezione R7).

## L'ospite (notte del 3 settembre 2026, branch `ospite-server`)

Le cinque route AI di questo modulo (chiarimenti, extract-facts,
process-entry, split-by-date, transcribe-fallback) passano da
`requireOspiteOPremium` (src/lib/server/ospite.ts) invece di
`requirePremium`: dentro entra chi e premium O un ospite col braccialetto
e quota. Il GET di warm-up della trascrizione usa `{ consuma: false }`:
controlla senza spendere una giornata. `logAiUsage` riceve `...gate.chi`
(utente o braccialetto, e il flag regalo). L'indirizzo di OpenAI passa da
`openaiUrl()` (src/lib/server/openai.ts) per i banchi con l'OpenAI finto.
In `today-client.tsx` "salva e basta" (Cmd+S) non chiede piu i
chiarimenti: prometteva zero chiamate AI e ne faceva una, che per l'ospite
sarebbe stata una giornata del regalo spesa senza averlo chiesto.

## Le schermate dell'ospite (4 settembre 2026, branch `ospite-schermate`)

Mockup approvato `design/mockups/ospite-primo-avvio.html` (02-03). Due
cose in questo modulo:

- `components/avviso-regalo.tsx`: l'avviso discreto SOTTO la giornata
  appena chiusa dall'AI, quando restano 3 giornate o meno (decisione D).
  Uno slot di `FilledView` (`avvisoSlot`), montato da `today-client` solo
  per una giornata chiusa in questa visita (`savedDates`): mai all'avvio,
  mai nel Mese. La X lo chiude per quella giornata (localStorage
  `jm.ospite.avviso.<data>`). "Prova premium" apre il muro a schede.
- La vista gratis a regalo finito: `analyze-day.ts` distingue il 402
  (l'AI negata per scelta: regalo finito o serve premium) dal guasto, e in
  quel caso salva come giornata senza AI (`localFields`: titolo = prima
  riga, sintesi vuota). `today-client` legge lo stato del regalo
  (`src/lib/ospite/stato.ts`) SOLO quando c'e una giornata senza sintesi
  da decidere, e mostra la prosa con la frase del regalo (`nudgeTesto`)
  invece di quella di premium; "vedi" apre il muro del regalo.

Banco: `scripts/verify-ospite-schermate.mjs` (42 controlli, provato a
mordere: prima della distinzione del 402 la giornata a regalo finito
usciva con "Giornata raccontata" e il banco lo ha visto).
