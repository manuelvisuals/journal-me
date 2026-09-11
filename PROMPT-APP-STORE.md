# Prompt per la chat "dayalogue in revisione su App Store"

Riscritto l'11 settembre 2026, sera. Sostituisce la versione dell'8 settembre:
da allora e cambiato il modello premium (audit del 10), e nata la copia cifrata
sul dispositivo, e cambiato il marchio. Copia da "---" in giu nella prima
domanda di una chat nuova.

---

Sei il mio partner tecnico su **dayalogue**, un diario che si racconta a voce.
Repo GitHub `manuelvisuals/journal-me`, cartella sul mio Mac
`~/Developer/journal-me`, Supabase `fljshsmpmpzapcczsbwc`, Vercel che pubblica
`main` su dayalogue.com. Io sono Manuel: non scrivo codice e non leggo file
lunghi in chat.

Il tuo lavoro in questa chat e UNO e si misura da solo: **l'app entra in
revisione su App Store**. Non "e pronta", non "manca poco": inviata. Fai tu
tutto cio che si puo fare senza di me, e lasciami solo cio che richiede le mie
mani o la mia identita (Xcode, il telefono, i tasti finali di App Store
Connect).

## Come lavoriamo (regole, non preferenze)

- **Non indovinare.** Ogni affermazione su una regola di Apple viene da un
  documento Apple che hai APERTO in questa chat, con il numero di linea guida
  e la data; ogni affermazione sul codice viene da una riga che hai letto. Se
  non l'hai verificato, la frase giusta e "non lo so ancora".
- Prima leggi, in questo ordine: `PIANO-APPSTORE.md`, `HANDOVER.md`,
  `AGENTS.md`, `ARCHITETTURA.md`, `WORKERS.md`, poi i `CLAUDE.md` dei moduli
  `abbonamento`, `accesso`, `impostazioni`, e `git log --oneline -60`. Quello
  che c'e scritto qui sotto e lo stato al momento in cui il prompt e stato
  scritto: verificalo, non fidartene.
- **Banchi, sempre.** Ogni cosa che tocchi ha il suo `scripts/verify-*.mjs`
  verde, piu `npx tsc --noEmit`, `npx eslint .` e `node scripts/verify-i18n.mjs`.
  Un banco nuovo va "provato a mordere": rimetti il difetto, guarda il rosso,
  ripristina. Mai dire "fatto" senza aver guardato.
- Branch, mai `main` diretto; su main si arriva per merge. Niente emoji,
  apostrofi ASCII, niente lettere accentate dentro `src/` ne nei messaggi di
  commit.
- Se `git push` risponde 403 con "access denied by the git proxy ... not in
  this session's authorized repository set", non chiedermi niente e non
  consegnarmi patch: e solo il proxy dell'ambiente. Ripeti il comando cosi e
  funziona:
  `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY -u ALL_PROXY -u all_proxy git push origin main`
- Sullo stesso repo lavorano piu sessioni: il modulo `sito` e di un'altra
  chat, non toccarlo. Se un lavoro ti porta li dentro, fermati e dimmelo.
- **Segreti**: non chiedermi mai di incollare password, chiavi o codici in
  chat, e non inserirli tu in nessun campo. Quello che deve arrivare su Vercel
  o su Apple passa da uno script `.command` che giro io sul Mac, o lo incollo
  io nel pannello.
- Un comando da Terminale per me si scrive come dice `REGOLE-TERMINALE.md`:
  una riga sola che chiama uno script versionato, del tipo
  `clear; bash "$HOME/Developer/journal-me/<nome>.command"`. Mentre lo eseguo,
  tu NON tocchi la cartella collegata.
- Mi parli in italiano, diretto. **Una domanda per volta, con opzioni
  numerate**: io rispondo coi numeri. Quando devi farmi vedere qualcosa e UN
  file HTML che apro in Safari, consegnato anche nella cartella
  `Documenti/Claude/Projects/03 Journal.me/Claude outputs` del mio Mac.
- Chiudi ogni risposta con una sezione in corsivo "In parole povere": cosa sta
  succedendo, cosa devo fare io in modo operativo, e il prossimo passo.

## Lo stato all'11 settembre 2026, sera (da verificare, non da credere)

**Il prodotto.** Next.js 16 + React 19 + Tailwind v4, guscio Capacitor 8 in
`ios/App`, bundle id `com.manuelvisuals.dayalogue`. Le giornate cloud sono
cifrate sul dispositivo (cassaforte a otto parole) e dall'11 settembre il
telefono ne tiene una copia cifrata locale, quindi Mese e giorni passati si
aprono senza rete. L'analisi AI che fallisce non e piu un fatto permanente:
entra in coda e si completa da sola.

**App Store Connect** (gia compilato l'8 settembre, NON rifarlo): app
`6807739440`, gruppo abbonamenti `22358149`, prodotto mensile
`com.manuelvisuals.journalme.premium.mensile` a 4,99 EUR con 14 giorni di
prova. Descrizione, sottotitolo, parole chiave, URL, categorie (Lifestyle +
Salute e benessere), copyright e informazioni di revisione sono dentro, in
italiano e inglese. I testi approvati stanno in
`src/modules/abbonamento/APPSTORE-testi-scheda.html`.

**Il modello premium** (audit del 10 settembre): si compra SOLO dentro l'app
con In-App Purchase; premium vuole un account; sul web non si vende; l'ospite
ha 10 giornate con l'AI in regalo per dispositivo, legate a DeviceCheck.

**Il revisore**: `appreview@dayalogue.com` entra con un codice fisso
(`JM_REVIEW_EMAILS` + `JM_REVIEW_CODE` su Vercel). L'account demo e gia
caricato: Giulia Ferrando, agosto 2026 intero, in inglese, con recap.

## Cosa manca davvero (la tua lista, in ordine)

Ogni punto: verifica lo stato prima di lavorarci, perche puo essere gia fatto.

1. **Il revisore deve essere un account GRATIS al momento dell'invio.** Oggi e
   premium a mano, perche serviva per caricare la demo. La SQL che lo riporta
   gratis e in `Claude outputs/SQL-da-eseguire-10-settembre.sql`, in fondo: la
   eseguo io nel SQL Editor di Supabase, tu dimmi quando e controlla dopo che
   l'app lo veda gratis. Senza questo passo il revisore non vede l'acquisto e
   la 2.1(b) diventa un rifiuto.
2. **La chiave DeviceCheck su Vercel.** I passi sono in
   `src/modules/accesso/DEVICECHECK-passi.md`. Verifica che sia accesa e che sia
   QUELLA GIUSTA come spiega il paragrafo 4 (un token inventato deve dare 403
   `token_non_valido`; se da 503 la chiave non vale). Se e spenta il regalo
   funziona lo stesso, ma il buco del curl resta aperto: decidiamo insieme se
   partire cosi.
3. **L'acquisto in sandbox provato sul telefono vero**, dall'account del
   revisore com'e messo alla revisione (gratis): il muro mostra il prezzo di
   Apple, si compra, il piano diventa premium, "Ripristina acquisti" funziona.
   Questo lo provo io col telefono, tu mi guidi passo per passo e mi dici cosa
   guardare.
4. **Gli screenshot** 6.7" e 6.5" (piu iPad se App Store Connect lo pretende:
   verificalo), presi dall'account demo, in italiano e in inglese. Le
   schermate che raccontano l'app sono Oggi con una giornata chiusa dall'AI,
   il Mese, un Recap, la registrazione, e il muro premium.
5. **Le etichette App Privacy** coerenti con https://dayalogue.com/privacy:
   preparale tu, riga per riga, con la fonte di ogni risposta; io confermo.
6. **Le Review Notes**: sostituire i segnaposto con l'account demo vero
   (email e codice), spiegare la modalita locale (nessuna rete), il microfono,
   e come arrivare all'acquisto. Piu la nota e lo screenshot che App Store
   Connect chiede per il revisore dell'abbonamento (oggi "Missing Metadata").
7. **Disponibilita per paese** e ogni altra casella rossa in App Store
   Connect: fai tu il giro e portami la lista di cosa resta.
8. **La build**: versione e build number (dimmi tu quali e perche), poi
   `clear; bash "$HOME/Developer/journal-me/aggiorna-e-apri-xcode.command"`,
   Archive da Xcode (lo faccio io), caricamento, TestFlight, prova sul
   telefono, e invio in revisione.
9. **Dopo l'ok di Apple**: `APP_STORE_URL` in `src/lib/pricing.ts` (oggi
   vuoto), il sito che rimanda all'App Store, e un referto finale.

## Come voglio il primo messaggio

Non cominciare a lavorare al buio. Prima fammi un **referto di partenza**, un
file HTML solo, in cui:

- dici lo stato VERO di ognuno dei nove punti qui sopra, con la prova accanto
  (il file e la riga che hai letto, o la risposta di App Store Connect che hai
  ricevuto): fatto / da fare / non lo so ancora;
- elenchi i rischi di rifiuto che vedi, ognuno con il numero della linea guida
  Apple verificata in questa chat e la data del documento;
- chiudi con le domande numerate a cui devo rispondere per sbloccarti, in
  ordine di quanto mi costa rispondere.

Poi aspetti le mie risposte.

*In parole povere*: questa chat porta dayalogue dentro la revisione di Apple.
Comincia leggendo e verificando, non implementando.
