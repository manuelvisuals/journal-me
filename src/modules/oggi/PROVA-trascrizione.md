# Prova di trascrizione: OpenAI contro la dettatura di Apple

3 settembre 2026. Serve a decidere con dei numeri, non con due ricordi, se la
trascrizione puo tornare sul telefono. Il costo del regalo AI e per il 90%
l'audio: e l'unica leva vera, e finora nessuno l'ha misurata.

Storia, verificata nel git e non a memoria: la prima versione dell'app usava il
riconoscimento del browser (`e3eab71`, Web Speech it-IT) e lo ha buttato apposta
(`5a66bb1`). Il difetto scritto nel codice di allora e il tetto di 60 secondi di
Safari, che obbligava a far ripartire l'ascolto di continuo. Anche OpenAI ha
avuto il suo (`0846410`: allucinazioni, frasi mai dette).

## Il testo da leggere

Si legge DUE volte, uguale, a velocita normale, senza scandire e senza
correggersi. Le trappole sono dentro apposta: nomi propri, numeri, inglese
misto, omofoni, una autocorrezione parlata e un silenzio.

---

Oggi mi sono svegliato alle sette e mezza, che per un martedi - no, aspetta,
mercoledi - e gia un miracolo. Ho pesato ottantuno virgola quattro, quindi sono
sceso di quasi un chilo dall'ultima volta.

In palestra ho fatto panca piana sessanta per dieci, tre serie, poi stacchi e
lat machine. Christian c'era, mi ha detto che a novembre si trasferisce a Chiang
Mai con Ludovica, e che hanno gia firmato per l'appartamento in via Boccaccio.

[QUI STAI ZITTO E CONTA FINO A CINQUE, senza staccare il dito dal microfono]

Poi ho avuto la call con Gabriele e Ilenia sul brief nuovo di Xenovision. La
deadline e il tre ottobre, il budget e quarantaduemila e cinquecento piu IVA, e
devo mandare il PDF entro venerdi. Gabriele l'ha presa bene, Ilenia un po' meno:
ha detto che qual e il senso di rifare tutto adesso, e non ha tutti i torti.

A pranzo pizza con Serena. Era serena anche lei, per una volta. Abbiamo parlato
di quell'anno in cui hanno chiuso il locale sotto casa, e di come sia passato in
fretta.

Nel pomeriggio ho scritto per due ore, cioe... insomma, ho scritto per un'ora e
poi ho guardato il telefono per un'altra. La solita storia. Ah, e ho speso
quarantadue euro e cinquanta di taxi, che e un furto.

Stasera ho chiamato mia madre. Sta bene. Mi ha chiesto se torno per Natale e le
ho detto di si, anche se non lo so ancora.

Domani devo ricordarmi di pagare l'assicurazione, di rispondere a Kwame, e di
comprare il caffe.

---

## Come si esegue

1. **Nell'app.** Apri dayalogue, tieni premuto il microfono e leggi tutto,
   silenzio compreso, SENZA staccare il dito. Poi Fine. Arrivi alla schermata di
   correzione: **copia il testo prima di correggere qualsiasi cosa.** Quello
   corretto non serve a niente, e' il grezzo che si misura.
2. **Nelle Note.** Nota nuova, microfono della tastiera, stesso testo. Se
   l'ascolto si ferma da solo, riprendi e ANNOTA che e successo e a che punto:
   e' meta della misura.
3. Incolla i due risultati in chat, dicendo qual e' quale.

## Cosa si conta

Sette voci, sullo stesso testo:

- **nomi propri** (Christian, Ludovica, Gabriele, Ilenia, Serena, Kwame,
  Xenovision, Chiang Mai, Boccaccio): 9 bersagli;
- **numeri** (7 e mezza, 81,4, 60x10, 3 ottobre, 42.500, 42,50): 6 bersagli;
- **omofoni** (e/e', ha/a, anno/hanno, qual e', un po'): 5 bersagli;
- **inglese misto** (call, brief, deadline, budget, lat machine, PDF, IVA);
- **l'autocorrezione** "martedi no aspetta mercoledi": la tiene o la appiattisce;
- **il silenzio**: qualcuno ci scrive dentro una frase mai detta (allucinazione);
- **la punteggiatura**: quanto lavoro resta da fare a mano dopo.

Il glossario dell'app manda i nomi gia salvati in Ricorda: se Christian e'
gia' li', OpenAI parte avvantaggiata. E' un vantaggio vero del sistema di oggi,
non un imbroglio, ma va letto sapendolo.

## Risultato

### Giro 1 - dettatura di Apple (Note, iPhone 12), 3 settembre 2026 ore 16:36

Trascrizione grezza ricevuta. Punteggio contro il testo letto:

| Voce | Bersagli | Presi | Note |
|---|---|---|---|
| Nomi propri | 9 | 7 | sbagliati: Kwame -> "Kme"; Chiang Mai -> "Chiang * Michael". Xenovision preso |
| Numeri | 6 | 6 | tutti giusti E gia formattati: 7:30, 81,4, 60 x 10, 3 ottobre, 42.500, 42,50 EUR |
| Omofoni | 5 | 5 | e/e', ha/a, anno/hanno, qual e', un po'. Serena nome e serena aggettivo distinti |
| Inglese misto | 7 | 5 | sbagliati: deadline -> "Dead line"; lat machine -> "l'at machine" |
| Autocorrezione parlata | 1 | 1 | "martedi no aspetta mercoledi" tenuta intera |
| Silenzio di cinque secondi | 1 | 1 | nessuna frase inventata |
| Punteggiatura | - | no | quasi assente: un muro di testo senza punti |

Errori di SENSO, che contano piu degli altri perche l'AI a valle ci costruisce sopra:

- **"Christian c'era" -> "Christian NON c'era"**: fatto ribaltato. Un negativo
  inventato e peggio di un nome storpiato: extract-facts registrerebbe un'assenza
  che non c'e stata. (Da riconfermare al giro 2: puo essere anche una lettura.)
- "di rifare tutto" -> "di fare tutto"
- "entro venerdi" -> "entro entro venerdi" (parola raddoppiata)
- "e di comprare il caffe" -> "e comprare il caffe"

Sintesi onesta: molto meglio del ricordo che se ne aveva. I numeri sono
perfetti, gli omofoni pure, e nel silenzio non ha inventato niente. Perde sui
nomi rari e stranieri, e non mette punteggiatura.

### Giro 2 - OpenAI dentro l'app (gpt-4o-transcribe)

Primo tentativo FALLITO: clip di 1:24, schermata ferma su "Transcribing" per
cinque minuti. Causa poi individuata: mancava la rete. Vedi in fondo, e' un
difetto vero e sta scritto qui perche' e' nato da questa prova.

Secondo tentativo riuscito. Punteggio contro il testo letto:

| Voce | Bersagli | Apple | OpenAI |
|---|---|---|---|
| Nomi propri | 9 | 7 | **8** |
| Numeri | 6 | 6 | 6 |
| Omofoni (Serena/serena compresa) | 6 | **6** | 5 |
| Inglese misto | 7 | 5 | **7** |
| Autocorrezione parlata | 1 | 1 | 1 |
| Silenzio di cinque secondi | 1 | 1 | 1 |
| Punteggiatura | - | **no** | **si** |

Dove Apple sbaglia e OpenAI no: "Chiang Mai con" -> "Chiang * Michael" (due
volte su due, non e' un caso); "lat machine" -> "l'at machine" e poi "la latte
machine"; "deadline" -> "Dead line" (due volte su due, e la seconda si mangia
anche "e' il"); "Kwame" -> "Kme"; e nella stessa pagina scrive "Ilenia" la
prima volta e "Ylenia" la seconda.

Dove OpenAI sbaglia e Apple no: "era Serena anche lei" con la maiuscola
sull'aggettivo (Apple distingue il nome dall'aggettivo, OpenAI no); "il locale"
-> "un locale"; "le ho detto" -> "gli ho detto"; "non ha tutti i torti" -> "non
ha tutti torti". Sono limature, non fatti cambiati.

**La differenza che decide, pero', non e' nella tabella.** Al primo giro Apple
aveva scritto "Christian NON c'era" dove il testo dice "Christian c'era". Al
secondo giro, stesso testo, l'ha scritto giusto. Cioe': **sbaglia in modo
intermittente, e quando sbaglia inventa un fatto falso senza nessun segnale.**
Su un diario che alimenta un estrattore di fatti, un negativo di troppo diventa
una riga di storia personale mai avvenuta. Nessun numero della tabella pesa
quanto questo.

Seconda differenza pesante: **la punteggiatura.** OpenAI restituisce prosa
leggibile; Apple restituisce un muro di testo senza un punto. Nell'app il testo
grezzo E' la sorgente di verita' e si legge cosi' com'e' nella giornata: non e'
cosmetica, e' il prodotto.

## Verdetto

**Vince OpenAI, e la trascrizione resta dov'e'.** Manuel aveva ragione a
memoria; la proposta di riportarla sul telefono era un'opinione basata sul costo
e non ha retto alla misura.

Conseguenze, gia' decise:

- il regalo AI si calcola su **circa 25 centesimi a persona** (10 giornate a
  voce piu' un recap). Non c'e' una scorciatoia: il 90% e' l'audio, e l'audio
  resta su OpenAI;
- questa domanda e' CHIUSA. Chi la riapre porta numeri nuovi, non ricordi.

## Difetto trovato durante la prova (CHIUSO il 3 settembre 2026, branch `scheletro-rete-tetto`)

Senza rete, dopo aver premuto Fine, l'app resta su "Transcribing" **per sempre**
e non mostra nessun errore. Confermato da Manuel: al primo tentativo il telefono
era senza internet.

Perche'. La chiamata che trascrive e' protetta da un tetto di 120 secondi
(`recording-overlay.tsx`), ma **davanti** ha una lettura senza nessun tetto:
`loadPersonaNames()` (i nomi da Ricorda per il glossario), che passa dal client
Supabase, il quale non ha nessun timeout configurato
(`src/lib/supabase/client.ts`). Senza rete quella promessa non si risolve mai,
quindi il codice non arriva nemmeno alla chiamata protetta - e la schermata di
errore, che esiste gia' e mostra pure la riga di diagnostica
(`gum=... http=...`), non viene raggiunta.

Un secondo punto scoperto nello stesso percorso: in `apiFetch`
(`src/lib/api.ts`) l'`await getAccessToken()` sta PRIMA che parta
l'AbortController, quindi un rinnovo di gettone appeso non e' coperto dal tetto.
In questo caso specifico era innocente (il gettone era fresco: due chiamate
riuscite otto minuti prima), ma il buco resta.

**Come si riproduce, gratis:** modalita' aereo, registra qualcosa, premi Fine.

**Attenzione:** i due file da correggere (`src/lib/api.ts`, `src/lib/data/`)
sono SCHELETRO, non modulo. Serve una sessione scheletro dichiarata e l'ok di
Manuel (AGENTS.md regola 1).

### Come e stato chiuso (3 settembre 2026, sessione scheletro dichiarata, SPEC R11)

Tre cose, in tre posti, piu un banco:

1. **`src/lib/tetto.ts`** (nuovo, scheletro): `conTetto`, `conSegnale`,
   `fetchConTetto`. Nessuna primitiva inventata: sono `setTimeout` +
   `AbortController`, e l'errore ha sempre `name === "AbortError"` come
   quello di `fetch` interrotta, cosi chi gia gestiva l'abort non impara
   niente di nuovo. Niente `AbortSignal.any`/`timeout`: arrivano tardi su
   WebKit.
2. **`src/lib/supabase/client.ts`**: il client Supabase riceve
   `global.fetch = fetchConTetto(30_000)` (opzione standard di supabase-js).
   Da qui OGNI richiesta del client - letture, scritture, upload, rinnovo del
   gettone - ha un tetto, in un punto solo. Era il buco vero: `loadPersonaNames`
   passava di li senza nessun limite.
3. **`src/lib/api.ts`**: in `apiFetch` il cronometro parte PRIMA di
   `getAccessToken()`, che sta sotto lo stesso segnale (`conSegnale`). Il
   tetto vale sull'intera operazione, non solo sulla fetch.
4. **`recording-overlay.tsx`** (modulo oggi, toccato dalla sessione scheletro
   perche e la sede del tetto di 120 s): il glossario ha un tetto suo di 4 s
   (`GLOSSARIO_TETTO_MS`: migliora la trascrizione, non la abilita), la
   chiamata riceve cio che resta dei 120 s (`TRASCRIZIONE_TETTO_MS`), il clip
   viene conservato (`clipRef`) cosi "premi di nuovo Fine" riprova con lo
   stesso audio invece di dire "non e arrivato audio", e il messaggio dice
   cosa e successo (senza rete / tempo scaduto) e cosa fare.

**Banco:** `scripts/verify-rete-spenta.mjs`, 14 controlli. Registra con un
microfono sintetico (Web Audio: nel sandbox non esiste nessun dispositivo,
nemmeno quello finto di Chromium), tiene la lettura del glossario in un buco
nero (richiesta trattenuta da Playwright, mai risposta: e cio che fa un
telefono senza segnale) e pretende il messaggio entro 15 s. Misurato: 4,05 s.
**Provato a mordere:** rimesso `await loadPersonaNames()` senza tetto, 4
controlli rossi (nessun messaggio in 15 s, il POST della trascrizione non
parte mai): lo stesso sintomo del telefono. Ripristinato, 14/14.

Serve un dev server con `NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co`
e una `NEXT_PUBLIC_SUPABASE_ANON_KEY` qualsiasi in `.env.local`: il banco
costruisce una sessione finta nel localStorage e intercetta tutto cio che va
verso quell'host.

**Non verificato sul telefono**: la prova in modalita aereo sull'iPhone e
ancora da fare da Manuel (referto atteso: messaggio entro pochi secondi, poi
"Fine e salva" che riprova col racconto intatto appena torna la rete).
