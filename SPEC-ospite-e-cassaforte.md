# SPEC - Ospite, account, cassaforte

Deciso da Manuel il 3 settembre 2026. Mockup approvato:
`design/mockups/ospite-e-cassaforte.html` ("ottima presentazione", 3 settembre).

**Questo documento dice COSA deve essere vero e COSA non si deve fare. Il COME
lo sceglie chi implementa.** Dove trovi una tecnologia nominata, e' un esempio o
un vincolo dichiarato come tale, non un ordine: se ne conosci una migliore che
soddisfa lo stesso requisito, usala e scrivi qui perche'.

Prima di toccare codice: `ARCHITETTURA.md` (la mappa), `HANDOVER.md` (regole e
trappole), `WORKERS.md` (branch e parallelo), `AGENTS.md` (regole comuni), e il
`CLAUDE.md` del modulo in cui lavori. In caso di conflitto fra questo documento
e il codice, vince il codice - e poi si corregge questo.

---

## 1. Il problema, in una riga

L'app va pubblicata sull'App Store e serve il massimo numero di persone che la
provano. Oggi al primo avvio ci sono due muri: una domanda ("dove vuoi tenere il
tuo diario?") posta a chi non ha ancora visto niente, e l'AI chiusa dietro email
piu' codice a sei cifre. Chi sceglie la strada gratis non vede mai l'AI, quindi
non si affeziona e non comprera' mai.

Manuel paga di tasca sua un assaggio di AI per tutti. In cambio vuole attrito
zero all'ingresso e una promessa di riservatezza vera, non dichiarata: **il
creatore dell'app non deve poter leggere i diari delle persone.**

---

## 2. Le tre condizioni

| | Come ci si arriva | Dove stanno le giornate | AI |
|---|---|---|---|
| **Ospite** | aprendo l'app. Non fa niente e non sa di esserlo | solo sul dispositivo | accesa, a quota regalata |
| **Account** | mette una email, quando glielo chiediamo noi | sul dispositivo E sul server, cifrate | come sopra |
| **Premium** | paga | come sopra, piu' backup automatico | senza limiti |

Nessuna condizione e' una versione mutilata dell'altra. Si sale perche'
conviene, mai perche' l'app blocca.

---

## 3. Cosa deve essere vero

Ogni voce e' un'affermazione verificabile. Se non sai come provarla, non e'
scritta bene: torna qui e riscrivila prima di implementarla.

### R1 - Il primo avvio non chiede niente

- Chi installa l'app e la apre per la prima volta arriva **direttamente sulla
  giornata di oggi**, senza nessuna schermata intermedia, nessuna domanda,
  nessun testo da leggere e nessun tocco obbligatorio.
- Da quella schermata puo' gia' parlare o scrivere.
- La scelta "dove tenere il diario" **sparisce dal primo avvio**. Continua a
  esistere come voce in Impostazioni, per chi la vuole.
- Verificabile: da installazione pulita, il numero di tocchi fra l'apertura e il
  primo carattere scritto e' **zero**.

### R2 - L'AI funziona senza account, con una quota

- L'AI (voce, titolo, sintesi, aree, fatti) e' accesa per l'ospite, fino a una
  quota.
- Il server deve poter attribuire ogni chiamata a un ospite preciso senza
  conoscerne l'identita': niente email, niente nome, niente password.
- La quota e' contata **sul server**. Un conteggio che vive solo sul dispositivo
  non e' una quota, e' un suggerimento.
- **Reinstallare l'app non deve regalare una quota nuova.** L'ancoraggio e' il
  dispositivo, non l'installazione.
- L'ospite deve poter diventare account **senza perdere niente** di quello che
  ha gia' scritto, e senza rifare la quota da capo.
- Verificabile: un ospite consuma la quota, l'app viene disinstallata e
  reinstallata, la quota resta consumata.

### R3 - Quando la quota finisce, finisce solo l'AI

- L'app continua a funzionare: si scrive la giornata, si salva, si rilegge, si
  naviga il Mese e i Memo.
- L'invito a passare a premium compare **in quel momento**, non prima, e non
  all'avvio.
- Il consumo della quota e' silenzioso finche' non resta poco. Nessun contatore
  sempre a schermo, nessun allarme.
- Verificabile: a quota zero, salvare una giornata scritta riesce e non apre
  nessun muro.

### R4 - Un tetto di spesa che si chiude da solo

- Esiste un limite di spesa complessivo, nel tempo, oltre il quale il regalo si
  spegne per i nuovi ospiti.
- Il limite si legge e si cambia dal pannello `/admin`, senza un deploy.
- Quando scatta, chi sta gia' scrivendo non viene interrotto a meta'.
- Verificabile: abbassato il limite sotto il consumo corrente, un ospite nuovo
  non riceve piu' AI e un ospite in mezzo a una giornata la finisce.

### R5 - L'email si chiede dopo, una volta, e "non adesso" vale

- La proposta di mettere una email arriva **dopo che l'ospite ha qualcosa da
  perdere** (piu' giornate scritte, non al primo avvio, non a tempo).
- Dice la verita': le giornate sono solo su questo dispositivo, e se lo perde le
  perde.
- "Non adesso" e' una risposta vera. Non ritorna alla schermata dopo, e non
  degrada niente.
- Verificabile: rifiutando, l'app resta identica e la proposta non ricompare
  nella stessa sessione.

### R6 - La cassaforte: nessuno tranne l'utente puo' leggere

Questo e' il requisito piu' importante del documento.

- Il contenuto di una giornata (testo, titolo, sintesi, aree, fatti estratti,
  miniature delle foto) viene **chiuso a chiave sul dispositivo prima di
  partire**. Sul server arriva materiale illeggibile.
- Chi ha accesso completo al database - Manuel compreso, con la chiave di
  servizio che scavalca ogni protezione - **non deve poter ricostruire il
  contenuto**. Questa e' la prova di accettazione: si apre il database e si
  guarda.
- La chiave non lascia mai il dispositivo in chiaro e non arriva mai al server
  in nessuna forma da cui si possa risalire ad essa.
- **Non si inventa un metodo di cifratura.** Si usa una primitiva standard,
  diffusa e non deprecata, disponibile sia nel browser sia dentro il guscio iOS.
  Quale, lo sceglie chi implementa, e lo scrive qui.
- Restano in chiaro solo i dati che servono al server per fare il suo lavoro
  senza guardare dentro: a chi appartiene una cassettina, di che giorno e', che
  versione ha, quando e' stata scritta, quanto pesa. Nient'altro.
- Verificabile: un banco che scrive una giornata, la legge dal database col
  ruolo di servizio, e **fallisce** se ci trova una qualsiasi parola del testo.

### R7 - Una cassettina per giornata, con un numero di versione

- L'unita' cifrata e' **la singola giornata**, non il diario intero.
- Ogni cassettina porta un numero di versione che cresce a ogni scrittura.
- Il server **rifiuta** una scrittura che arriva con un numero non piu' attuale.
- Il dispositivo che si vede rifiutare una scrittura **avvisa la persona** che
  quella giornata e' stata modificata altrove, e le mostra entrambe le versioni.
  Non sceglie da solo e non cancella niente.
- Il server deve poter fare tutto questo **senza aprire le cassettine**.
- Verificabile: due sessioni, la seconda con una copia vecchia; il salvataggio
  della seconda viene rifiutato e l'avviso compare. Nessun dato perso.

### R8 - La chiave, e come si recupera

- Su un dispositivo Apple la chiave deve viaggiare **da sola** verso gli altri
  dispositivi Apple della stessa persona: nel caso normale, chi cambia iPhone e
  lo ripristina non deve fare nulla.
- Per gli altri casi (un browser su un computer non Apple, chi ha spento la
  sincronizzazione del portachiavi) esiste un **codice di recupero**, dato una
  volta sola nel momento in cui si crea l'account.
- Il codice si inserisce una volta per dispositivo, poi non viene piu' chiesto.
- **La perdita e' definitiva e va detta chiaramente**, nel momento in cui si da'
  il codice, non in una nota a pie' di pagina: perso il codice e persi tutti i
  dispositivi, il diario non e' recuperabile da nessuno.
- Non esiste, e non deve essere costruito, nessun percorso di reimpostazione
  lato server: sarebbe una porta di servizio nella cassaforte.
- Verificabile: un banco che simula un dispositivo nuovo senza chiave, mostra
  che i dati esistono ma non si aprono, e che col codice si aprono.

### R9 - Il backup automatico (premium)

- Una volta al giorno, il dispositivo carica le cassettine cambiate. Solo
  quelle.
- Si conservano **piu' versioni nel tempo**, non solo l'ultima: un backup che
  sovrascrive sempre lo stesso stato puo' cancellare i dati buoni con quelli
  rovinati.
- Il ripristino su un dispositivo nuovo e' un percorso che una persona non
  tecnica riesce a completare da sola.
- Il salvataggio su file resta **gratuito per tutti** e non peggiora: e' la rete
  di sicurezza di chi non paga, e chi non paga e' la maggioranza.
- Verificabile: un banco che scrive N giornate, esegue il backup, azzera il
  dispositivo, ripristina, e confronta il contenuto giornata per giornata.

### R10 - Le foto

- Dentro la giornata vive una **miniatura**, cifrata come il resto. E' quella
  che si vede nel Mese, nella giornata e dentro il backup, su tutti i
  dispositivi.
- Accanto vive il **collegamento alla foto originale nel rullino**, usato per
  aprire la foto in qualita' piena sul dispositivo che l'ha scattata.
- Se il collegamento non risolve (foto cancellata, altro dispositivo), la
  miniatura resta e la giornata non ha buchi.
- La miniatura deve essere piccola per davvero: l'ordine di grandezza da
  rispettare e' **cinquanta volte meno** della foto originale.
- Verificabile: un banco che misura il peso di una giornata con dieci foto e
  fallisce sopra una soglia scritta.

### R11 - Il buco della rete (CHIUSO il 3 settembre 2026, branch `scheletro-rete-tetto`)

Trovato il 3 settembre 2026 durante la prova di trascrizione, e riprodotto:
referto completo in `src/modules/oggi/PROVA-trascrizione.md`.

Sintomo: senza rete, dopo aver premuto Fine, l'app resta su "sto trascrivendo"
**per sempre**, senza nessun messaggio. Cinque minuti su un clip di un minuto e
mezzo, e nessun errore.

Causa: la chiamata che trascrive e' protetta da un tetto di 120 secondi, ma
**davanti** ha attese che non ne hanno nessuno - la lettura dei nomi da Ricorda
per il glossario (`loadPersonaNames`, che passa dal client Supabase, il quale
non ha nessun timeout configurato) e, in `apiFetch`, il recupero del gettone di
accesso, che avviene **prima** che parta il cronometro. Il codice non arriva
nemmeno al punto in cui la schermata di errore - che esiste gia', e mostra pure
una riga di diagnostica - verrebbe mostrata.

Cosa deve essere vero dopo:

- **Nessuna attesa di rete, in nessun punto dell'app, puo' durare
  indefinitamente.** Ogni chiamata che esce dal dispositivo ha un tetto.
- Il tetto vale sull'**intera operazione** vista dalla persona, non sul singolo
  pezzo: se un'operazione e' fatta di tre attese, e' l'operazione a dover
  finire, non le tre attese una per una.
- Quando un'operazione fallisce o scade, la persona **vede sempre qualcosa**:
  un messaggio che dice cosa e' successo e cosa puo' fare. Il silenzio non e'
  un esito ammesso.
- Cio' che non e' essenziale non deve poter bloccare cio' che lo e': il
  glossario migliora la trascrizione, non la abilita. Se non arriva, si trascrive
  lo stesso.
- Verificabile, e questa e' la parte che conta: **un banco che spegne la rete,
  registra, e pretende che entro un tempo scritto compaia un messaggio.** Si
  prova a mordere: si rimette il difetto, il banco deve diventare rosso.

Com'e' stato fatto (il COME, scritto qui come chiede l'intestazione):
`src/lib/tetto.ts` (conTetto / conSegnale / fetchConTetto: setTimeout +
AbortController, errore sempre `AbortError`), `fetchConTetto(30 s)` come
`global.fetch` del client Supabase (un tetto su ogni richiesta, in un punto
solo), cronometro di `apiFetch` che parte prima del gettone, glossario con 4 s
di tetto e clip conservato per riprovare in `recording-overlay.tsx`. Banco
`scripts/verify-rete-spenta.mjs` (14 controlli, messaggio in 4 s, morso
verificato). Referto: `src/modules/oggi/PROVA-trascrizione.md`.

### R12 - Cosa NON cambia per chi gia' usa l'app

- Le giornate gia' scritte da Manuel non si perdono e restano leggibili.
- Il passaggio alla cassaforte per i dati gia' esistenti e' un percorso
  esplicito, non un effetto collaterale di un aggiornamento.
- Le funzioni esistenti (Mese, Memo, Recap, Impostazioni, palestra, sito) non
  cambiano comportamento.

---

## 4. I divieti

Cose che questo lavoro **non** fa. Ognuna ha un motivo, e il motivo conta piu'
del divieto: se il motivo cade, si riapre.

1. **Niente scrittura in tempo reale parola per parola fra dispositivi.** E' la
   tecnologia che serve a due persone che scrivono insieme lo stesso paragrafo.
   Qui c'e' una persona sola che scrive da un dispositivo alla volta: e'
   attrezzatura pesante per un lavoro che non esiste. I numeri di versione (R7)
   coprono il caso vero, che e' la copia vecchia.
2. **Niente aggiornamento automatico degli schermi accesi**, per ora. Si
   aggiunge dopo, sopra lo stesso impianto, senza rifare niente. Non serve alla
   prima versione.
3. **Niente foto in qualita' piena sul server.** Solo miniature. E' la voce che
   puo' far esplodere il conto dello spazio.
4. **Niente pagamento vero dentro l'app iOS.** Resta come oggi
   (`PREMIUM_IOS_V1_GRATIS`, vedi `src/lib/pricing.ts`): Apple vuole il suo
   sistema, e la decisione e' rimandata da Manuel.
5. **Niente percorso di recupero lato server per la chiave.** Vedi R8.
6. **Non si tocca la trascrizione.** Misurata il 3 settembre 2026 contro la
   dettatura di Apple: vince OpenAI, e non di poco. La domanda e' CHIUSA. Chi la
   riapre porta numeri nuovi, non ricordi. Referto in
   `src/modules/oggi/PROVA-trascrizione.md`.
7. **Nessuna schermata promette qualcosa che non esiste.** E' gia' costato due
   volte (il "primo mese incluso" che non c'era, il selettore di lingua che non
   traduceva). Se una funzione non c'e', la riga non c'e'.

---

## 5. Il contratto che questo lavoro CAMBIA

Va scritto, non subito di nascosto.

Oggi esiste una promessa verificata da un banco (`verify-pr10`): **in modalita'
locale l'app non fa nemmeno una richiesta di rete.** Accendere l'AI per
l'ospite, che tiene le giornate sul dispositivo, rompe quella promessa cosi'
com'e' formulata.

La promessa nuova, che sostituisce la vecchia e va scritta nel banco:

> Delle giornate dell'ospite, sul server non resta niente. Il testo esce dal
> dispositivo solo nel momento in cui l'ospite chiede all'AI di lavorarci, e
> solo per quello: non viene scritto ne' conservato da nessuna parte.

Il banco va riscritto per verificare la promessa nuova, non cancellato. Un banco
cancellato e' una promessa che smette di esistere in silenzio.

Conseguenza da dichiarare anche fuori dal codice: nell'etichetta privacy
dell'App Store e nella pagina della privacy, perche' e' vera solo se e' detta.

---

## 6. Decisioni gia' prese (non si riaprono senza Manuel)

- Ospite -> account -> premium, in quest'ordine (Manuel, 3 settembre).
- La cassaforte si costruisce **prima** della pubblicazione, non dopo: farla
  dopo significa convertire i diari gia' scritti di migliaia di persone, e per
  tutta quella finestra la promessa sarebbe falsa.
- Chi perde la chiave perde il diario. Accettato esplicitamente da Manuel.
- Il testo passa dal server nel momento in cui l'AI lavora, senza essere
  conservato. Accettato esplicitamente da Manuel.
- Le operazioni che con la cassaforte il server non puo' piu' fare, le fa il
  dispositivo. Accettato esplicitamente da Manuel.
- La trascrizione resta su OpenAI (vedi divieto 6).

---

## 7. Decisioni ancora di Manuel (servono prima di finire)

Chi implementa **non le decide da solo**. Se manca la risposta, si costruisce
il meccanismo con il valore configurabile e si chiede.

1. **Quanto e' grande il regalo.** Quante giornate con l'AI. Ordine di
   grandezza noto: dieci giornate raccontate a voce piu' un recap costano circa
   25 centesimi a persona (il 90% e' l'audio). Mille download sono 250 euro,
   diecimila sono 2.500.
2. **Il tetto di spesa mensile** oltre il quale il regalo si spegne (R4).
3. **Dopo quante giornate** si chiede l'email (R5).
4. **Quante versioni di backup** si conservano e per quanto (R9).

---

## 8. Perimetri e permessi

Questo lavoro attraversa piu' moduli e tocca lo scheletro. Per AGENTS.md regola
1, lo scheletro non si tocca da dentro un modulo: serve una **sessione scheletro
dichiarata**. Manuel ha dato l'ok il 3 settembre 2026 per il perimetro qui
sotto, e solo per questo.

| Pezzo | Dove vive | Nota |
|---|---|---|
| Cassaforte, chiave, versioni | scheletro (`src/lib/data/`, store) | il contratto `JournalStore` e' il posto giusto: le schermate non devono sapere che esiste una chiave |
| Tetti di tempo e messaggi d'errore (R11) | scheletro (`src/lib/api.ts`, `src/lib/data/`) | il difetto sta qui, non in un modulo |
| Ospite, quota, primo avvio, email | modulo `accesso` | piu' le pagine che il suo CLAUDE.md elenca |
| Quota, muro, premium | modulo `abbonamento` | e' il modulo piu' importato: le altre schermate passano dalla porta |
| Tetto di spesa, quota per condizione | modulo `admin` | era gia' previsto ("allowance per tier") |
| Backup | scheletro + `impostazioni` | il backup v1 esiste gia': si estende, non si riscrive |
| Foto e miniature | modulo `oggi` | |

Se un compito ti porta fuori da questa tabella: **fermati e chiedi a Manuel.**

---

## 9. L'ordine dei lavori

Un pezzo = un branch = un banco. Ogni pezzo deve lasciare l'app funzionante: se
ci si ferma dopo il terzo, non deve restare niente a meta'.

1. **Il buco della rete (R11).** Per primo perche' e' un difetto vivo, e' piccolo
   e non dipende da niente. Un microfono che si pianta per sempre e' la cosa
   peggiore che possa capitare a un utente nuovo il primo giorno.
2. **La cassaforte e le cassettine (R6, R7, R8).** Il pezzo grosso. Va prima
   dell'ospite perche' tutto il resto ci appoggia sopra.
3. **L'ospite e la quota (R1, R2, R3, R4).** Compreso il cambio di contratto
   della sezione 5.
4. **La domanda dell'email (R5).**
5. **Il backup automatico (R9).**
6. **Le foto (R10).**

Prima del codice di ogni pezzo che si vede: **un mockup, e l'ok di Manuel.**
Vale per il primo avvio, per la proposta dell'email, per il codice di recupero e
per il muro della quota. Non vale per il pezzo 1, che non ha schermate nuove.

---

## 10. Come si verifica

Non negoziabile, per ogni pezzo, prima di ogni push:

- `npx tsc --noEmit` e `npx eslint .` puliti;
- il banco del modulo toccato, piu' `node scripts/verify-i18n.mjs`;
- il lint dei confini fra moduli, che e' una regola ESLint a ERRORE e quindi
  gira gia' dentro `npx eslint .`. **Attenzione:** `ARCHITETTURA.md` cita
  `scripts/verify-confini.mjs` come guardia dei prefissi CSS, ma quel file NON
  esiste (verificato il 3 settembre 2026: in `scripts/` c'e' solo
  `verify-css-split.mjs`). Chi tocca il CSS di un modulo controlla i prefissi a
  mano, oppure scrive quella guardia - e in tal caso corregge anche
  ARCHITETTURA.md;
- il banco nuovo del pezzo, **provato a mordere**: si rimette il difetto, si
  vede il rosso, si ripristina. Un banco che non e' mai stato rosso non e' una
  prova, e' una decorazione.

E le due regole che in questo progetto sono costate piu' delle altre:

- **Quando qualcosa "non si salva", si chiede prima al database e poi al
  codice.** E' gia' successo di cercare per ore nel posto sbagliato.
- **Non si dichiara risolto un difetto senza averlo visto risolversi.** Un
  "fatto" detto in anticipo non e' una cortesia, e' una bugia.
