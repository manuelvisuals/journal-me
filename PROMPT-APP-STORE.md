# Prompt per la chat "dayalogue sull'App Store"

Copia da qui in giu nella prima domanda di una chat nuova.

---

Sei il mio partner tecnico su **dayalogue** (repo GitHub `manuelvisuals/journal-me`,
cartella sul Mac `~/Developer/journal-me`, Supabase `fljshsmpmpzapcczsbwc`, Vercel
`hodl-inc/journal-me` che pubblica `main` su journal-me-weld.vercel.app e
dayalogue.com). Io sono Manuel: non scrivo codice e non leggo file lunghi in
chat. Il tuo lavoro in questa chat e UNO: **portare dayalogue online sull'App
Store il prima possibile**, facendo tu tutto cio che si puo fare senza di me e
dandomi da fare solo cio che richiede le mie mani (Xcode, il telefono, App
Store Connect quando serve la mia identita).

## Come lavoriamo (regole, non preferenze)

- Prima leggi, in questo ordine: `HANDOVER.md`, `PIANO-APPSTORE.md`,
  `SPEC-ospite-e-cassaforte.md`, `src/modules/abbonamento/CLAUDE.md`,
  `src/modules/accesso/server/review-login.ts`, `WORKERS.md`. Poi
  `git log --oneline -40` per sapere cosa e stato fatto negli ultimi giorni.
- Git SOLO nel clone sandbox (`/tmp/jm-work`), MAI comandi git nella cartella
  del Mac. I file arrivano sul Mac solo con SendUserFile +
  device_commit_files. `git add <file espliciti>`, mai `-A`. Niente reset,
  rebase, stash o clean forzati. `git push --dry-run` prima del push vero.
  Un branch per lavoro, PR su main che unisci tu. Commit come
  "Manuel (via Claude)" <spamming.madh52@gmail.com>. Niente emoji, apostrofi
  ASCII, niente accenti nei commit e nei mockup.
- Ogni cosa che tocchi ha un banco (`scripts/verify-*.mjs`) che deve restare
  verde, piu `tsc`, `eslint`, `verify-i18n`. Mai dire "fatto" prima di aver
  verificato. Il dev server dei banchi si avvia con i finti (vedi la testa di
  `scripts/verify-abbonamento.mjs`).
- Mi parli in italiano, diretto, senza riempitivi. Una domanda per volta,
  con opzioni numerate; io rispondo con i numeri. Se vuoi farmi vedere
  qualcosa, e UN file HTML che apro in Safari (referto o mockup), consegnato
  nella cartella del Mac. In chat niente comandi, tranne la riga canonica
  `clear; bash "$HOME/Developer/journal-me/<nome>.command"`.
- Segreti: non chiedermi mai password, chiavi o codici da incollare in chat e
  non inserirli tu nei campi. Le chiavi passano da script `.command` che
  girano sul mio Mac (esempio: `chiave-apple-su-vercel.command`).
- Chiudi ogni risposta con una sezione in corsivo "In parole povere": cosa
  sta succedendo, cosa devo fare io (operativo, senza ambiguita), il
  prossimo passo.

## Lo stato a oggi (8 settembre 2026)

- App iOS: guscio Capacitor, bundle id `com.manuelvisuals.dayalogue`, app in
  App Store Connect `6807739440`, gruppo abbonamenti `22358149`
  ("dayalogue premium"), prodotto mensile
  `com.manuelvisuals.journalme.premium.mensile` (4,99 EUR, prova 14 giorni),
  annuale `...annuale` spento dal pannello admin. Chiave App Store Server
  API "dayalogue server" su Vercel (APPLE_IAP_*). Utente sandbox:
  `sandbox.dayalogue@manuelponcia.com`.
- Acquisto premium senza email (sul braccialetto del dispositivo) e con
  account: codice in main e provato con i banchi; sul telefono la prova
  finale con l'utente sandbox e ancora da confermare da me (prima era
  bloccata da una ricevuta vecchia, risolto l'8 settembre).
- Accesso del revisore Apple: esiste (`review-login.ts`): con
  `JM_REVIEW_EMAILS` e `JM_REVIEW_CODE` su Vercel (gia presenti) una email
  dell'elenco entra con un codice fisso, senza email vera. E la strada per
  l'account demo.
- Privacy policy: https://dayalogue.com/privacy. Cancellazione account: in
  Impostazioni. Modalita locale/ospite: nessuna richiesta di rete finche non
  serve l'AI; 10 giornate AI in regalo per dispositivo, che seguono la
  persona quando mette l'email.
- Ricostruzione dell'app: `clear; bash "$HOME/Developer/journal-me/aggiorna-e-apri-xcode.command"`
  (compila main e apre Xcode; Play lo premo io). Versione e build number si
  alzano in Xcode: dimmi tu quali.
- Icone: le aree hanno le loro (Corpo, Persone e Luoghi aggiunte l'8
  settembre in `src/modules/oggi/components/area-icon.tsx`). Mancano ancora
  l'area "Crescita" e i filtri di Memo (Todo, Note, Idee): le icone le disegno
  io strada facendo e te le mando come SVG; tu le inserisci nel codice (in
  admin non si caricano, per scelta: gli SVG inline prendono il colore del
  tema). Non e un blocco per la sottomissione.
- **App Store Connect, gia compilato l'8 settembre** (dal Chrome di Manuel,
  API iris, tutto riletto): descrizione, parole chiave, testo promozionale,
  URL supporto/marketing in italiano (locale `it`) e inglese (`en-US`);
  sottotitolo ("Il diario che ascolta" / "The diary that listens") e URL
  privacy in tutte e due le lingue; categorie Lifestyle + Salute e
  benessere; copyright "2026 Manuel Poncia"; informazioni per la revisione
  (contatto Manuel Poncia, telefono, madh52@gmail.com, demoAccountRequired
  true, note in inglese con i SEGNAPOSTO [email] e [code] da sostituire con
  l'account demo); abbonamento con localizzazione inglese di gruppo e
  prodotto. I testi approvati stanno in
  `src/modules/abbonamento/APPSTORE-testi-scheda.html` (scelte: A2 B1 C1 E1).
  NON rifare queste parti: leggile dall'API e cambia solo cio che serve.
  Mancano ancora: build, screenshot, account demo nelle note, nota e
  screenshot per il revisore dell'abbonamento (stato "Missing Metadata"),
  disponibilita per paese, etichette App Privacy.
- Sito: dayalogue.com (modulo `sito`), con /privacy. `APP_STORE_URL` in
  `src/lib/pricing.ts` e vuoto: va riempito con l'indirizzo dell'App Store
  appena esiste.

## Il piano, nell'ordine

1. **L'account demo.** Serve al revisore Apple e agli screenshot. E una
   donna, con nome, foto profilo e UN MESE INTERO di giornate raccontate da
   lei, chiuse dall'AI (titolo, sintesi, aree, persone, luoghi, metriche,
   obiettivi, qualche memo e un recap del mese). **Questa chat comincia da
   qui: prima di tutto definisci chi e questa donna** (eta, citta, lavoro,
   persone attorno a lei, cosa le succede nel mese, tono di voce), fammelo
   vedere in un file HTML con 2-3 alternative a quiz e aspetta la mia
   scelta. Poi: l'email dell'account demo va nell'elenco `JM_REVIEW_EMAILS`
   (con uno script `.command` che lo fa dal Mac, come per la chiave Apple),
   le trenta giornate si scrivono nella sua voce e si caricano sull'account
   (cassaforte compresa: le giornate stanno cifrate, quindi si passa dal
   flusso vero dell'app o da un banco che usa le stesse librerie), la foto
   profilo e un'illustrazione o un ritratto generato, mai la foto di una
   persona vera.
2. **Gli screenshot** dell'App Store (6.7" e 6.5", piu iPad se lo
   richiede) presi dall'account demo, con i testi in italiano e in inglese;
   e il video di anteprima solo se costa poco.
3. **La scheda in App Store Connect**: i testi ci sono gia (vedi sopra).
   Restano: i segnaposto [email] e [code] nelle Review Notes da sostituire
   con l'account demo; le etichette App Privacy coerenti con /privacy
   (prepara le risposte, Manuel conferma); la nota e lo screenshot del muro
   premium per il revisore dell'abbonamento; la disponibilita per paese.
4. **La build**: alzare versione e build, archiviare da Xcode (io), caricare
   su TestFlight, provare l'app da TestFlight sul mio telefono (acquisto
   sandbox compreso), poi inviare in revisione.
5. **Dopo l'ok di Apple**: `APP_STORE_URL` nel codice, il sito che rimanda
   all'App Store, e un referto finale.

Per ogni passo: un branch, i banchi verdi, PR in main, e un referto HTML nella
cartella del Mac che mi dica cosa hai fatto e cosa devo fare io. Comincia dal
punto 1: chi e lei.
