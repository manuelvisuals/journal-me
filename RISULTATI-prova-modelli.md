# Quale modello estrae i fatti, e quanto costa

Prova eseguita il 22 agosto 2026 sul sito vero, con la chiave OpenAI
dell'account di Manuel. Quindici racconti scritti a mano nello stile in cui si
parla davvero (`scripts/eval-fatti-casi.json`), ventotto fatti attesi, sei
trappole. Ogni modello ha ricevuto gli stessi testi e lo stesso prompt.

Non e una classifica di intelligenza: e una misura su **questo** compito, con
**questi** testi. E l'unico modo di rispondere a "quale modello e meglio"
senza citare un blog.

## Il risultato

| modello | fatti trovati | vietati usciti | normalizzazione | costo / 15 racconti |
|---|---|---|---|---|
| gpt-4o-mini (quello in uso) | 21/28 - 75% | 1 | 1/2 | $0,0023 |
| **gpt-5.6-luna** | **25/28 - 89%** | **0** | 1/2 | $0,0061 |
| gpt-4.1-mini | 25/28 - 89% | 0 | 1/2 | $0,0065 |
| gpt-5-mini | 24/28 - 86% | 2 | 1/2 | $0,0513 |

"Vietati usciti" sono i fatti che **non dovevano esserci**: e la colonna che
conta piu di tutte. Un fatto inventato entra nei conteggi e non si distingue
da uno vero.

## Cosa e successo davvero, trappola per trappola

**Il proposito.** "vorrei andare in palestra domani" - tutti e quattro
capiscono che non e un allenamento. Nessuno segna la palestra.

**Il ricordo.** "mi e tornato in mente quando l'anno scorso sono andato a Roma
con Giulia" - al primo giro `gpt-4o-mini` e `gpt-5.6-luna` hanno estratto
**Giulia** come persona vista oggi. Ho riscritto la regola nel prompt in modo
esplicito ("se una frase comincia con 'mi e tornato in mente', tutto cio che
contiene va ignorato") e ho rilanciato: Luna e passata a **zero**. E il motivo
per cui questa prova esiste - senza, quella riga sbagliata sarebbe finita in
produzione e nessuno se ne sarebbe accorto.

**La negazione.** "oggi niente palestra e niente alcol" - `gpt-5-mini` ha
estratto **palestra** e **alcol** come fatti. E l'errore peggiore della prova:
segna un allenamento che non c'e stato. Gli altri tre leggono la negazione.

**Il locale che sembra una persona.** "pomeriggio da Bubba Cafe" - tutti lo
mettono fra i luoghi, nessuno crea una persona di nome Bubba.

**L'invenzione.** Una giornata di solo lavoro, senza nessun cibo nominato:
nessun modello ha aggiunto un caffe. Era la paura principale, e non si e
avverata.

## La normalizzazione: 1 su 2, e non e colpa del modello

"panca 60 per 10" e "panca piana, tre serie da 60" devono dare la stessa
chiave, o il grafico dei progressi si spezza in due meta che non si sommano
mai. Nessun modello ci riesce da solo: Luna scrive `panca` in un racconto e
`panca piana` nell'altro.

**Ma la cura funziona, ed e gia nella spec** (SPEC-fatti §3.3): passare al
modello l'elenco delle etichette che l'utente usa gia. Provato:

- senza elenco: `attivita:panca`, `attivita:trazioni`
- con l'elenco: `attivita:panca piana`, `attivita:trazioni`

Si aggancia. Quindi la normalizzazione non e un problema di modello, e un
pezzo di sistema - la tabella degli alias piu l'elenco passato nel prompt - e
quel pezzo va costruito comunque.

## Il costo, con i numeri veri

Per estrarre i fatti di **una** giornata: `gpt-4o-mini` $0,00015,
`gpt-5.6-luna` $0,00041. Luna costa **2,7 volte**.

Detto in soldi: con cinque salvataggi al giorno, l'estrazione dei fatti costa
circa **6 centesimi di dollaro al mese** con Luna contro 2 con 4o-mini. Su un
abbonamento da 4,99 euro.

Nota su cosa si confronta: `extract-facts` **sostituisce** `extract-people`
(SPEC-fatti §4.1), quindi non e una chiamata in piu, e la stessa che cambia
mestiere.

## Cosa consiglio

**gpt-5.6-luna per i fatti.** Trova il 19% in piu di 4o-mini, non inventa
niente, e costa quattro centesimi al mese in piu.

`gpt-4.1-mini` pareggia sulla qualita e costa uguale: e la seconda scelta se
Luna dovesse dare problemi.

`gpt-5-mini` e da escludere: sbaglia la negazione e costa otto volte, perche
consuma 24.000 token di uscita contro i 3.200 di Luna (ragiona a lungo prima
di rispondere, e qui non serve).

Per il riassunto della giornata (`process-entry`) non ho ancora misurato
niente: e un compito di stile, non di precisione, e 4o-mini potrebbe bastare.
Va provato a parte, con la sua prova.
