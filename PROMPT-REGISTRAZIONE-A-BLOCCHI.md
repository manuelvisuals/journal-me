# Prompt per fable — La registrazione a blocchi

Sei un'operaia sul progetto Dayalogue. Prima di toccare codice leggi, in
quest'ordine: `HANDOVER.md`, `ARCHITETTURA.md`, `WORKERS.md`, `AGENTS.md`
(in particolare il §6, che rimanda a `REGOLE-TERMINALE.md`), e poi
`src/modules/oggi/CLAUDE.md`, che e il tuo recinto: questo lavoro sta tutto
nel modulo OGGI.

Ramo tuo, mai `main`. Alla fine apri una PR.

---

## 1. Cosa e successo davvero (il difetto, misurato)

Il 14 settembre 2026, alle 23:45, Manuel ha raccontato la giornata in due
sessioni di push-to-talk per un totale di 3 minuti e 52. La schermata ha
detto ERROR e, nella riga di diagnosi che l'app stampa apposta:

```
[gum=#1/live mr=audio/webm;codecs=opus n=226 b=6717776 http=413]
```

Si legge cosi: il microfono ha consegnato 226 pezzi per **6.717.776 byte**
(6,7 MB) — quindi l'audio c'era tutto, intero — e il server ha risposto
**413**, cioe "corpo della richiesta troppo grande". Su Vercel il corpo di
una richiesta si ferma a ~4,5 MB: il file non e mai arrivato alla funzione
che trascrive, l'ha rifiutato l'infrastruttura prima.

Due numeri che contano per tutto il resto:

- **29,7 KB al secondo** (6.717.776 / 226), cioe circa **238 kbit/s**: e la
  qualita di fabbrica del browser, roba da musica. Il tetto reale di oggi e
  **circa due minuti e mezzo di parlato**.
- La funzione `/api/transcribe-fallback` ha `maxDuration = 60`: **60
  secondi di esecuzione**. Anche un file che stesse sotto i 4,5 MB, se e
  lungo, non fa in tempo a farsi trascrivere e prende un errore diverso e
  altrettanto opaco.

Quindi il tetto non e uno solo: **peso E tempo**. Chi corregge solo il peso
ha risolto meta problema e lo scopre in produzione.

---

## 2. Cosa deve diventare (decisione di Manuel, 14 settembre)

**La registrazione a blocchi, come le note vocali.** Si parla in blocchi da
N minuti; quando il blocco e pieno si chiude e, se hai altro da dire, ne
cominci un altro. L'utente lo sa **prima** di cominciare, non lo scopre
quando e troppo tardi.

- **Il tempo che scorre e quello REALE di registrazione**, cioe i secondi
  in cui il tasto e tenuto premuto. Con il push-to-talk il registratore e in
  pausa mentre pensi: un conto alla rovescia sull'orologio direbbe una
  bugia (30 secondi rimasti quando invece ne hai due minuti). Si conta
  quello che viene inciso, punto.
- **Barra di avanzamento + timer**, visibili mentre parli. La barra si
  ferma quando lasci il tasto e riparte quando lo premi.
- Quando il blocco e pieno: si chiude da solo, l'utente vede che e chiuso e
  sa che puo cominciarne un altro. I blocchi si sommano in un racconto solo.

**N = 3 minuti**, deciso da Manuel il 14 settembre 2026. E il valore che
sta comodo sotto tutti e due i tetti (vedi §4) senza spezzettare il
racconto: Instagram usa 1 minuto, ma per una giornata raccontata un minuto
costringerebbe a cinque blocchi. Se durante il lavoro scopri un motivo
tecnico per cui 3 minuti non stanno sotto i tetti su un dispositivo vero,
NON cambiarlo da sola: fermati e dillo a Manuel col numero misurato.

---

## 3. Il pezzo che NON si puo fare, e da cui discende il disegno

**Un file audio non si taglia dopo.** Un webm o un mp4 spezzato a meta non
si apre: hanno un'intestazione all'inizio e un indice che regge tutto.
Quindi i blocchi si fanno **mentre si registra**, fermando il
`MediaRecorder` e aprendone uno nuovo sulla stessa traccia del microfono.

Il punto giusto dove chiudere un blocco e **quando l'utente lascia il tasto**,
cioe in un silenzio: fermare e riaprire costa qualche decina di
millisecondi e in un silenzio non se ne accorge nessuno. Se invece uno
parla ininterrottamente fino al limite, il taglio va fatto lo stesso e li
una sillaba si perde: e il prezzo, va scritto nel codice e non nascosto.

---

## 4. Le regole dei numeri

Un blocco si chiude quando arriva **per primo** uno di questi:

1. **il tempo inciso** supera **3 minuti**;
2. **i byte incisi** superano **3,5 MB** (margine sotto i 4,5 del server:
   la multipart aggiunge intestazioni, e il margine serve anche se il
   browser ignora la qualita richiesta — vedi sotto).

La seconda regola non e un doppione: e la rete di sicurezza. Se il telefono
ignora la qualita che gli chiediamo, il tempo da solo non basta.

**La qualita di registrazione va chiesta, e poi misurata.**
`audioBitsPerSecond` e una richiesta, non un ordine: Chrome la rispetta,
WebKit su iPhone puo ignorarla. Quindi:

- si chiede **mono** (`channelCount: 1` nei vincoli di `getUserMedia`);
- **Opus: 32 kbit/s.** Il modello che trascrive riduce comunque tutto a 16
  kHz mono: sopra gli 8 kHz butta via, e oggi paghiamo sette volte per
  informazione che viene scartata;
- **mp4/AAC: 64 kbit/s.** A 32 l'AAC impasta le consonanti, che sono
  esattamente cio che distingue un nome proprio. Non si usa lo stesso
  numero per due codec diversi;
- il ritmo reale (byte al secondo) si **misura** dai pezzi che arrivano, e
  la barra si basa su quello, non sul numero sperato.

---

## 5. La trascrizione dei blocchi

- I blocchi si trascrivono **in ordine** e i testi si uniscono con uno
  spazio (non con il separatore `\n---\n`: quello e il separatore dei
  racconti aggiunti in giorni diversi, non dei pezzi di uno stesso
  racconto).
- **A ogni blocco si passa il glossario** (c'e gia: le persone di Ricorda,
  header `X-JM-Glossary`) **e la coda del testo del blocco precedente come
  contesto**. Questo e importante e ha una storia: il percorso realtime fu
  abbandonato proprio perche "il modello non vedeva mai piu di un
  frammento" e i nomi propri ne soffrivano (sta scritto in testa a
  `recording-overlay.tsx`). Tagliando si ricrea quella condizione ai bordi:
  la cucitura serve a compensarla.
- **Il tetto di tempo va reso per blocco.** Oggi `TRASCRIZIONE_TETTO_MS`
  (120s) e un budget unico per tutta l'operazione: con cinque blocchi in
  fila lo si sfonda e la giornata si salva senza testo, cioe lo stesso
  danno di stasera con un'altra faccia.
- **Se un blocco fallisce, si tiene quello che e arrivato.** Oggi
  `transcribeClip` torna stringa vuota su qualunque errore e chi la chiama
  non distingue "muto" da "guasto": con i blocchi questa regola va
  rovesciata. Nel punto mancante si scrive che li manca un pezzo (una riga
  onesta, tradotta), e il resto del racconto si salva. Meglio un racconto
  con un buco dichiarato che nessun racconto.
- Valuta (e proponi a Manuel, non decidere da sola) se far partire la
  trascrizione di un blocco **mentre si registra il successivo**: a fine
  racconto l'attesa sarebbe quasi zero. E un guadagno vero ma aggiunge
  concorrenza: se lo fai, l'ordine dei testi non deve dipendere
  dall'ordine di risposta.

---

## 6. Il messaggio d'errore

Quello di stasera diceva "controlla la connessione e premi di nuovo Fine e
salva". La connessione non c'entrava, e ripremendo falliva identico: il
file era sempre quello. Un 413 deve dire cosa e successo davvero. Dopo
questo lavoro non dovrebbe piu capitare, ma il messaggio resta per il caso
che non abbiamo previsto, e deve essere vero.

---

## 7. Il recinto e le regole della casa

- Si lavora in `src/modules/oggi/`: `components/recording-overlay.tsx` e il
  file principale. Prefissi CSS del modulo (`jm-rec`, `jm-ptt`, ...): niente
  classi nuove fuori prefisso.
- **Non si tocca `src/lib/actions/save-recording.ts`** (scheletro: si cambia
  solo d'accordo con Manuel) se non e strettamente necessario; se serve,
  fermati e chiedi.
- **Attenzione al nome**: nel codice "split" e gia occupato da
  `split-by-date`, che smista un racconto su piu GIORNI. Per l'audio usa
  un'altra parola (blocchi, spezzoni) o fra un mese nessuno capisce piu
  quale split e quale.
- Testo a schermo sempre via `t()` e traduzioni in `src/modules/oggi/en.ts`;
  `node scripts/verify-i18n.mjs` deve restare verde.
- Misure in `calc(Npx * var(--jm-ui-scale))`, colori dai token.
- Niente emoji, apostrofi ASCII, italiano nei commenti.
- Prima del push: `npx tsc --noEmit`, `npx eslint .`, `verify-i18n`, piu il
  banco del modulo.

## 8. Il banco

Metti la matematica dei blocchi in un file **puro** (nessun import di
React, nessun alias), sul modello di `src/modules/oggi/pezzi.ts`: quando
chiudere un blocco, quanto tempo resta, come si uniscono i testi. Il banco
(`scripts/verify-registrazione-blocchi.mjs`, `node
--experimental-strip-types`) prova quella, piu i controlli sui chiamanti.

Casi che il banco deve coprire, perche sono quelli dove si perde un
racconto:

- il tempo inciso cresce solo mentre il tasto e premuto;
- il blocco si chiude sul tempo **o** sui byte, quello che arriva prima;
- l'unione dei testi rispetta l'ordine anche se le risposte tornano
  disordinate;
- un blocco fallito non porta via gli altri;
- zero blocchi (nessuna parola detta) non produce un racconto vuoto salvato.

**Prova il morso**: rompi di proposito ogni regola e verifica che il banco
diventi rosso. Un banco che non morde non e un banco.

## 9. Cosa NON fare

- Non tagliare un blob audio gia registrato (§3).
- Non rimettere in piedi il percorso realtime: e stato tolto per due motivi
  documentati.
- Non far dipendere la barra da un bitrate teorico: solo dai byte veri.
- Non dichiarare "fatto" senza aver misurato il ritmo reale sul dispositivo
  (la riga di diagnosi stampa gia `n` e `b`: e li che si legge).
- Non allargare il lavoro ad altri moduli. Se serve, fermati e chiedi.

## 10. Alla fine

PR con: cosa cambia, i numeri misurati prima/dopo (byte al secondo, peso di
un blocco pieno), l'esito dei banchi, e **cosa NON hai potuto provare dal
vivo** — in particolare la prova su iPhone, che richiede una build
TestFlight e quindi Manuel.
