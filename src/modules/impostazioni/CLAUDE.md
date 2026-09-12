# Modulo IMPOSTAZIONI

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Impostazioni a pannelli (obiettivi, lingua, tema, dimensione testo, dati,
account, moduli utente), la rail destra su desktop e la schermata Consumi AI
con la barra della quota. Pagina: `src/app/(app)/app/settings/`.

- Prefissi CSS (misurati): `jm-st`, `jm-usage`, `jm-cs`, `jm-sw`, `jm-theme`,
  `jm-backup`, `jm-lang`, `jm-foto`.
- I dati dei consumi arrivano da `src/lib/data/usage.ts` e `/api/usage`
  (scheletro).
- Banchi prima del push: `verify-impostazioni`, `verify-lingua`,
  `verify-parole-misure`, `verify-checkout-obiettivi`, `verify-consumi`,
  `verify-foto-profilo`, `verify-nome-profilo`, `verify-profilo-ovunque`,
  `verify-profilo-dopo-login`, `verify-foto-profilo-vivo`
  (piu tsc, eslint, verify-i18n). Foto e nome si eseguono con
  `node --experimental-strip-types`: leggono un contratto `.ts`;
  `verify-profilo-ovunque` apre il browser sul dev server :3100 coi finti.
- Le API del modulo (passo E): `src/modules/impostazioni/server/usage.ts`,
  `delete-account.ts`, `avatar.ts`, `nome.ts`; le rotte in `src/app/api/`
  sono gusci.

## Le schede dei temi (5 settembre 2026)

Mockup approvato: `design/mockups/tema-schede-nuove.html` (scelta "A piu C"
di Manuel); `design/mockups/tema-schede-finale.html` e la resa esatta del
CSS che sta in `styles.css`, aperta in un browser.

La versione precedente metteva TESTO VERO dentro un riquadro alto 108px
fissi. Quante righe diventa quel testo non lo decide il CSS: lo decidono il
font del tema (quattordici, fra cui un monospace e due garamond), la lingua
e la larghezza della colonna. Su iPhone, in inglese, in IBM Plex Mono erano
cinque righe: il testo usciva dal riquadro e si stampava sopra il nome.

Due regole da non togliere, se qualcuno rimette le mani qui:

1. **Dentro l'anteprima non entra testo che possa andare a capo.** Una riga
   sola con `white-space: nowrap` e i puntini; il resto sono forme (barre,
   pillola). L'altezza viene da `aspect-ratio`, non da un numero.
2. **`min-width: 0` su `.jm-theme-card` e `.jm-theme-meta`.** Un figlio di
   grid non puo farsi piu stretto del suo contenuto: senza quella riga il
   nome dei font su riga unica allarga la colonna oltre il telefono invece
   di farsi tagliare.

## Il profilo: foto e nome (28 agosto 2026)

Mockup approvati: `design/mockups/foto-profilo-flusso.html` (la foto) e
`design/mockups/nome-profilo.html` (il nome: pennina in linea sul computer,
pennina nel menu sul telefono — "strada A"). Nati da due segnalazioni di
Manuel: il pallino era 32px accanto a due bottoni da 44 e non c'era modo di
metterci una faccia; e il nome che l'app mostrava — "madh52" — non l'aveva
scelto nessuno, era la sua email tagliata alla chiocciola.

**Chi la mostra non e chi la cambia.** Il pallino vive nello SCHELETRO
(`src/components/ui/account-menu.tsx`, intestazione del telefono e rail del
computer). Il modo di cambiarla vive qui. Il ponte e la porta:
`index.ts` esporta `useProfilo`, `useNomeMostrato`, `apriPannelloNome` e
`svuotaProfilo` (per il logout), e
lo scheletro importa `@/modules/impostazioni`, come gia fa con il muro
premium di abbonamento. **I salvataggi NON escono dalla porta**: leggere il
profilo lo puo fare chiunque, cambiarlo solo questo modulo.

I pezzi:

- `profilo.ts` — lo store. **Dal 7 settembre 2026 nome e foto valgono per
  tutti, anche da ospite, e la fonte e locale**: localStorage `jm.profilo`
  = `{ nome, foto, daOspite }`, letto in modo sincrono al primo snapshot
  (niente lampeggio). Da ospite si legge e scrive solo li (`daOspite:
  true`). Con l'account: salvare = locale + `/api/account/nome` e
  `/avatar` (errore a schermo se fallisce, e si torna indietro); leggere =
  locale subito, poi UNA volta per apertura `profiles`: se il locale porta
  `daOspite: true` sale sul server e il segno si toglie, altrimenti il
  server vince e aggiorna il locale, anche vuoto (cancellare dal Mac vale
  ovunque). `svuotaProfilo()` al logout e alla cancellazione dell'account.
  Niente migration, niente busta (deciso da Manuel). Le righe Foto profilo
  e Nome compaiono in ogni modalita; nel menu e nella rail il nome scelto
  sostituisce "Questo dispositivo". Banco: `verify-profilo-ovunque`.
- `profilo-contract.ts` — **senza nessun import, di proposito**: l'aritmetica
  del ritaglio, la convalida del formato, e le regole del nome
  (`normalizzaNome`, `nomeMostrato`). Sono le cose che sbagliano in silenzio
  (una foto tagliata storta sembra una scelta di disegno), e senza import un
  banco le puo ESEGUIRE in Node invece di leggerne il testo.
- `components/foto-row.tsx` — la riga, il foglio delle tre scelte
  (`variant="riga"`, telefono) o il ritratto cliccabile della rail
  (`variant="avatar"`, computer), e il ritaglio a schermo pieno.
- `components/nome-riga.tsx` — `NomeRiga` (computer: pennina al passaggio del
  mouse, campo in linea, Invio salva ed Esc annulla) e `NomePanel` (telefono:
  la schermata aperta dalla pennina del menu).
- `server/avatar.ts`, `server/nome.ts` + le rotte in `src/app/api/account/`.

**Il nome ha UNA regola sola.** `nomeMostrato` (nome scelto, altrimenti
l'email tagliata alla chiocciola) vive in `profilo-contract.ts` e la chiamano
tutti. Prima viveva in due punti — `account-menu.tsx` e `settings-client.tsx`
— e un nome scelto che ne raggiungesse uno solo avrebbe mostrato **due nomi
diversi nella stessa schermata**. Il banco lo controlla: se qualcuno rimette
uno `split("@")` in uno di quei due file, esce rosso.

**La pennina del telefono non modifica dove sta.** Vive nella testata del
menu (scheletro) e chiama `apriPannelloNome()` piu `router.push("/settings")`:
un menu apre le cose, non le contiene. Il passaggio non usa i parametri
dell'indirizzo perche in Next 16 vorrebbero un Suspense attorno a mezza
pagina per una cosa che dura un istante.

**Perche la scrittura passa dal server e non da una policy.** `profiles`
contiene anche `plan`, e le policy di Postgres valgono per RIGA, non per
colonna: dare all'utente l'update sulla propria riga significherebbe dargli
il permesso di scriversi `plan = 'premium'`. Il service role scrive solo
`avatar_data` e solo per chi ha presentato il token. **Non aggiungere una
policy di update su `profiles`.**

**La foto sta nella riga, non in un bucket.** 256px in JPEG sono ~14 KB in
base64: un deposito file per quella taglia sarebbe piu superficie di quanta
ne risparmi, e cosi la foto sparisce da sola con l'account (cascade della
006), senza che `delete-account.ts` debba sapere che esistono immagini.

**Servono le migration 016 e 017** (`016_profile_avatar.sql`,
`017_profile_name.sql`): finche non sono incollate nel SQL Editor di
Supabase, la lettura risponde "niente di scelto" e il salvataggio da errore.
Non e un guasto silenzioso — `profilo.ts` tratta le colonne mancanti come
"niente di scelto", non come schermata rotta.

**Cosa i banchi NON coprono.** Non aprono un browser: provano aritmetica,
regole, convalide, misure e innesti. Il foglio che sale, il trascinamento del
ritaglio, la pennina che compare al passaggio del mouse e il campo che prende
il posto del nome vanno guardati con gli occhi, sul deploy o con gli altri
banchi Playwright.

La barra in alto (30 agosto 2026, scheletro): il nome della schermata e il
pallino dell'account NON stanno piu nell'intestazione di questo modulo, ma
in `src/components/ui/app-bar.tsx`, montata una volta sola dal guscio. Non
rimontare `AccountMenu` qui: `verify-barra-alto` diventa rosso.

## L'interruttore Face ID (1 settembre 2026)

Riga "Face ID" nel gruppo "I tuoi dati" di settings-client: compare solo
nel guscio iOS e solo se la biometria esiste davvero; accenderlo fa una
prova vera (`provaEAttivaFaceId`) e salva "on" solo se il volto ha aperto.
Il contratto e in `src/lib/native/face-id.ts` (scheletro): la proposta dopo
il login vive nel modulo accesso, il lucchetto nello scheletro.

## Impostazioni > Cassaforte (3 settembre 2026, SPEC R12)

Riga "Cassaforte" nel gruppo "I tuoi dati" (solo in cloud) e pannello
`CassafortePanel` in `panels.tsx` (mockup `codice-di-recupero.html` 04). La
riga dice lo stato VERO (`contaCassaforte()` in src/lib/data/cassaforte.ts):
"Tutto chiuso a chiave" oppure quante giornate/righe sono ancora in chiaro.
Il passaggio e un tasto esplicito ("Chiudi a chiave le N giornate"), mai un
effetto collaterale di un aggiornamento: legge, chiude, scrive e cancella
riga per riga. "Vedi il codice di recupero" chiede il volto sul telefono
(`chiediIlVolto`, scheletro). Classi nuove: `jm-st-cassa-*`. Banco:
`verify-cassaforte` (sezione R12).

## L'ospite in Impostazioni (4 settembre 2026, branch `ospite-schermate`)

Mockup approvato `design/mockups/ospite-primo-avvio.html` (04). In
modalita locale con l'ospite acceso (`ospiteAttivo()`, di fabbrica dal 4
settembre) il gruppo Account del telefono dice lo stato vero invece di
"Locale": "Dove sono le mie giornate" (apre il pannello `where`, con le
parole dell'ospite: il testo esce quando l'AI ci lavora, mai "nemmeno una
richiesta di rete"), "AI in regalo" con il conto letto dal server
(`components/regalo-panel.tsx`, `valoreRegalo`; pannello `regalo` con
usate/rimaste e le tre frasi), "Passa a Premium" (apre il muro a schede;
la riga dice "14 giorni gratis" e "Poi 4,99 EUR al mese"), "Accedi al tuo
account". Sul desktop la rail destra ha la riga "AI in regalo" (bottone,
`jm-st-rrow-btn`) e "Passa a Premium"; la pill "Locale" sparisce. Il conto
NON si calcola qui: `src/lib/ospite/stato.ts` chiede a /api/ospite/stato.
Il pannello `where` col locale "puro" (jm.ospite = "0") tiene le parole di
prima. Banco: `scripts/verify-ospite-schermate.mjs`.

Dal 4 settembre sera (branch `premium-senza-password`): la riga **Copia nel
cloud: Spenta** e la porta all'email (C1) e apre /login; "Ho gia un account"
al posto di "Accedi". (Il nome vecchio era "Backup ogni notte": un backup
notturno non esiste in nessuna riga di codice, e il 10 settembre 2026 la
riga ha preso il nome della cosa che esiste davvero.)

**Premium vuole un account** (Manuel, 10 settembre 2026, branch
`premium-vuole-account`). Qui c'erano tre rami per il "premium sul
dispositivo" (`usePremiumDispositivo`): la riga Piano che diceva "Premium
fino al {data}", "Gestisci abbonamento", e "Passa a Premium" che spariva.
Non ci sono piu: un ospite premium non esiste, quindi da ospite le voci
dell'abbonamento sono sempre quelle di chi non ha ancora comprato. Al posto
di "Ripristina acquisti" c'e **"Ho gia un abbonamento"**, che porta al login:
per chi non ha un account, ripristinare vuol dire prima ritrovare il proprio.

## Il Recap e un modulo, e il dock lo dice senza parole (4 settembre 2026, sera)

Richiesta di Manuel: il quinto posto del dock e il Recap di fabbrica; il
Recap e un modulo come la Palestra (`src/lib/modules.ts`, acceso di
fabbrica, `jm:moduli:recap-spento` ricorda chi lo spegne). Nel pannello
Moduli il primo acceso porta il **dock in miniatura** (`DockGlyph`,
`.jm-st-dock-glyph`) accanto al nome e la riga scivola in cima quando lo
accendi (`.jm-st-row.nel-dock`): il posto nel dock si capisce guardando,
non leggendo. Testi ridotti: "Accendi quello che vuoi. L'ultimo acceso va
nel dock." / "Spegnere non cancella niente." Banco: verify-persona-moduli.

## Il profilo che non si rileggeva (9 settembre 2026)

Dal telefono, dopo logout e login, la foto restava sparita per minuti. In
`profilo.ts` la lettura di `profiles` si ricorda una volta per apertura, ma
si ricordava anche quando usciva PRIMA di leggere (modalita locale, nessun
utente ancora, errore di rete): nessuno rileggeva piu. Ora le uscite
anticipate azzerano la memoria, e una vedetta su SIGNED_IN rilegge subito
al login nuovo. Banco: `verify-profilo-dopo-login` (7 controlli, morso
provato: col vecchio codice 4 rossi).

## La foto profilo, provata dal vivo (9 settembre 2026)

`verify-foto-profilo` prova il ritaglio e i contratti senza browser;
`verify-foto-profilo-vivo` apre il browser sui finti e fa le tre cose come
una persona (carica, cambia, toglie), controllando pallino, riga di
Impostazioni, riga `profiles` sul server finto e la tenuta dopo un
ricaricamento (17 controlli, morso provato). `scripts/prova-foto-profilo.mjs`
fa lo stesso su dayalogue.com dal Chrome del Mac con l'account demo, e
rimette la foto di Giulia alla fine.

## Gli esiti passano dal toaster, non da una riga (10 settembre 2026)

Segnalato da Manuel con lo screenshot: dopo aver cambiato la foto del
profilo, "Foto profilo aggiornata." compariva come riga grigia incastrata
fra Face ID e il gruppo Account — a meta schermata, lontana dalla riga che
aveva toccato, in mezzo a impostazioni che non c'entravano. Un esito e un
avviso di passaggio, non una riga di impostazione.

- `say(testo, errore?)` in `settings-client.tsx` NON tiene piu uno stato:
  chiama il TOASTER dell'app (`src/components/ui/toast.tsx`, lo stesso di
  "Premium ripristinato." e del salvataggio di una giornata). `say("")`
  non e un messaggio vuoto ma un "azzera", e diventa `toast.hide()`.
  Passano da qui: foto profilo, nome, export, import, cancellazione
  locale, Face ID, cancellazione dell'account.
- Stessa cosa per gli errori del pannello Obiettivi (`panels.tsx`), che
  erano un `.jm-st-note err` in fondo all'elenco: con la tastiera aperta e
  la lista che scorre li vedevi solo per caso.
- `.jm-st-note` RESTA, ma adesso e solo la nota STATICA di un pannello (la
  frase che spiega e resta li, tipo "Spegnere non cancella niente."). Se un
  domani ci rimetti dentro un esito, il banco diventa rosso.
- NON convertito: l'errore del pannello Cassaforte
  (`jm-st-cassa-errore`), che vive dentro un flusso a passi con la sua
  barra di avanzamento e resta accanto al tasto che ha fallito. E una
  scelta, non una dimenticanza.
- Banco: `verify-impostazioni` (60 controlli; i cinque nuovi guidano la
  cancellazione locale fino in fondo e pretendono il toaster 'ok' sopra la
  pagina, nessuna riga nuova nell'elenco, e la sparizione da sola dopo
  2,5s). Provato a mordere: rimettendo la riga vecchia escono 4 rossi.

## Account in cima, App a parte, elimina l'account si scrive (10 settembre 2026)

Manuel, guardando le Impostazioni sul telefono:

- via la card Recap e via la riga Memo: erano gia nel dock, e una seconda
  porta per la stessa stanza dentro un elenco fa solo lista. ATTENZIONE:
  con un modulo acceso, sul telefono Memo perde il posto nella barra in
  basso e quella riga era la strada che gli restava; se torna a dare
  fastidio, la risposta e nella barra, non qui. La prop `latestRecap` e
  sparita anche dalla pagina.
- via la sezione "Cosa vede il server" dal pannello Cassaforte.
- il gruppo Account e il PRIMO blocco (chi apre le Impostazioni cerca quasi
  sempre se stesso), e versione, pacchetto e "Esci dall'account" sono
  passati in un gruppo "App": non dicono chi sei, dicono cosa hai
  installato. Dall'11 settembre 2026 il gruppo App non sta piu sotto
  Account ma in fondo, fra "I tuoi dati" e la zona pericolosa (Manuel).
  Su desktop il blocco resta nascosto (`jm-st-phoneonly`,
  l'identita e nella rail destra): per questo i banchi aspettano il primo
  gruppo VISIBILE.
- "Elimina l'account" non e piu un secondo tocco su "si, elimina" (un tasto
  che compare dove prima c'era la riga si preme per sbaglio): apre
  `AlertIos` con `parolaDaScrivere`, e il tasto rosso resta spento finche
  nel campo non c'e ELIMINA (DELETE in inglese, la parola arriva gia
  tradotta da chi chiama). Banco: `verify-appstore` sezione 4, morso
  provato.

## Primo utilizzo: il gruppo Account dell'ospite (12 settembre 2026)

Manuel, dallo screenshot di Settings al primo avvio (branch
`impostazioni-primo-utilizzo`):

- la riga Nome senza un nome scelto dice **"Il tuo nome"** (cosa ci va), non
  "Questo dispositivo" (che nome sarebbe?). Il ripiego nel menu dello
  scheletro e nel pannello resta "Questo dispositivo"; il pannello Nome
  parte VUOTO con il suggerimento "Il tuo nome" quando non c'e ne email ne
  nome scelto (prima si apriva con "Questo dispositivo" da cancellare).
- **una porta sola all'email**: "Ho gia un account" con sotto "Accedi su
  questo dispositivo." La riga "Ho gia un abbonamento" non c'e piu: portava
  allo stesso /login. Il ripristino di Apple resta raggiungibile dal muro
  (da ospite) e da "Ripristina acquisti" nell'account. I banchi
  `verify-appstore` (sezione 2) e `verify-abbonamento` (ospite) pretendono
  la porta unica.
- "Dove sono le mie giornate" e "Copia nel cloud: Spenta" sono scese nel
  gruppo **"I tuoi dati"**: parlano delle giornate, non di chi sei. La porta
  all'email di "Copia nel cloud" (C1) e la stessa di prima.

## Il nome: una casella sola, un riempimento solo (12 settembre 2026, sera)

Manuel, guardando il telefono: la riga Nome diceva "Il tuo nome" e il menu
del pallino "Questo dispositivo", e sembravano due dati. Regola sua, alla
lettera: **tutti leggono la stessa casella del profilo, e quella casella di
fabbrica dice "Il tuo nome" (bilingue) finche l'utente non la sovrascrive.**

- `RIPIEGO_NOME = "Il tuo nome"` sta in `profilo-contract.ts` ed e il terzo
  ramo di `nomeMostrato` (scelto, altrimenti email tagliata, altrimenti
  questo). `useNomeMostrato(email)` lo traduce da solo: nessun chiamante
  passa piu una parola di ripiego.
- Chi lo mostra: la riga Nome e il ritratto di Impostazioni, il menu del
  pallino (`account-menu.tsx`, scheletro — toccato su richiesta esplicita),
  la rail del computer, e il pannello Nome (campo vuoto + placeholder, e
  la frase "Senza nome l'app dice Il tuo nome"). In locale si passa
  `email = null`: il nome dell'account non entra.
- Conseguenza voluta: senza nome l'iniziale del pallino e la I di "Il tuo
  nome" (Y di "Your name"). Se un giorno da fastidio, si cambia il ritratto,
  non la casella.
- Le chiavi "Questo dispositivo", "Ospite" e "ospite" sono uscite dal
  catalogo (orfane). Banchi: `verify-nome-profilo` (52, il contratto e
  la sorgente), `verify-porta-account` (la testata), `verify-profilo-ovunque`,
  `verify-barra-alto`, `verify-ospite-schermate`, `verify-impostazioni`.
  `verify-porta-account` muore al primo passo anche su main (cerca il
  pallino su /app in cloud senza passare il cancello); `verify-foto-profilo`
  ha due rossi vecchi dal 7 settembre (foto per tutti). Non sono di qui.

