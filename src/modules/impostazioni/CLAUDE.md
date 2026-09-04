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
  `verify-foto-profilo`, `verify-nome-profilo` (piu tsc, eslint,
  verify-i18n). I due banchi del profilo si eseguono con
  `node --experimental-strip-types`: leggono un contratto `.ts`.
- Le API del modulo (passo E): `src/modules/impostazioni/server/usage.ts`,
  `delete-account.ts`, `avatar.ts`, `nome.ts`; le rotte in `src/app/api/`
  sono gusci.

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
`index.ts` esporta `useProfilo`, `useNomeMostrato` e `apriPannelloNome`, e
lo scheletro importa `@/modules/impostazioni`, come gia fa con il muro
premium di abbonamento. **I salvataggi NON escono dalla porta**: leggere il
profilo lo puo fare chiunque, cambiarlo solo questo modulo.

I pezzi:

- `profilo.ts` — lo store: nome e foto da UNA lettura sola (nessuna
  richiesta in piu per il nome), anche con cinque pallini montati, e il
  ritorno indietro se il salvataggio fallisce.
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
