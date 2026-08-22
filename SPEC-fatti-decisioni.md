# I fatti, e le tue decisioni sopra

Addendum a `SPEC-fatti.md`, sezione 5. Nasce dall'audit del 22 agosto 2026,
che ha trovato tre difetti nel disegno precedente: una correzione "solo per
oggi" non aveva dove sopravvivere, gli alias erano una tabella che nessuno
leggeva, e un salvataggio fallito dei fatti spariva in silenzio.

---

## 1. La formula

Fino a ieri i fatti erano il risultato di una lettura:

```
fatti = leggi(testo)
```

Il difetto non e la formula, e che non c'e posto per te. Ogni volta che il
testo cambia si rilegge tutto da capo - regola giusta, decisa il 21 agosto -
e qualunque correzione tu abbia fatto viene cancellata insieme al resto.

La formula nuova ha due ingressi:

```
fatti = applica(decisioni, leggi(testo))
```

Il testo resta l'autorita su **cosa e successo**. Le tue decisioni sono
l'autorita su **come si chiama e se conta**. Nessuna delle due cancella
l'altra, e nessuna rilettura puo perdere quello che hai detto tu.

## 2. Che cos'e una decisione

Una riga che dice: *quando trovi questo, fai quest'altro*.

| campo | cosa contiene |
|---|---|
| `scope` | `giorno` (vale per quella data) oppure `sempre` |
| `entry_date` | la data, solo se `scope = giorno` |
| `kind` | su quale tipo agisce |
| `match_key` | il `label_key` che fa scattare la decisione |
| `action` | `rinomina`, `cambia_tipo`, `togli`, `aggiungi` |
| `to_label_key`, `to_kind`, `label`, `attrs` | il risultato |

Quattro azioni coprono tutti i casi visti finora:

- **rinomina** - "panca" vale "panca piana". Con `scope: sempre` e cio che
  ieri chiamavo alias.
- **cambia_tipo** - "palestra" e un'attivita, non un luogo.
- **togli** - questo fatto non c'era. Con `scope: giorno` toglie solo quel
  giorno; con `sempre` diventa una regola ("la palestra non e mai un luogo").
- **aggiungi** - un fatto che l'AI non ha visto. Ha sempre `scope: giorno`:
  aggiungere qualcosa "per sempre" non vuol dire niente.

**I fatti scritti a mano non sono piu un caso speciale**: sono decisioni di
tipo `aggiungi`. Un'unica strada invece di due, e quindi un solo punto dove
si puo sbagliare.

## 3. L'ordine di applicazione, e perche conta

```
togli  ->  cambia_tipo  ->  rinomina  ->  aggiungi  ->  unisci i doppioni
```

L'ordine non e arbitrario. Se si rinominasse prima di togliere, una regola
scritta sul nome vecchio non troverebbe piu il suo bersaglio. Se si
unissero i doppioni prima di rinominare, "panca" e "panca piana"
resterebbero due righe. E i doppioni si uniscono **per coppia (tipo,
chiave)** e non per sola chiave: "palestra" attivita e "palestra" luogo sono
due cose diverse, e sommarle darebbe un conteggio doppio.

## 4. Il passato

Quando crei una decisione `sempre`, l'app deve chiedere **una cosa in piu**:

> Applico anche alle giornate passate? Cambierebbe 12 righe in 9 giornate.

Senza questa domanda, i conteggi restano spezzati proprio sullo storico che
interessa: crei la regola oggi e "panca" e "panca piana" continuano a non
sommarsi per tutti i mesi precedenti. Con la domanda, la riscrittura e un
gesto esplicito, misurato e detto in anticipo - non un effetto collaterale.

Le decisioni `giorno` non hanno passato: valgono per la loro data e basta.

## 5. Cosa si ripara nel codice, oltre al disegno

**a) Un salvataggio fallito deve vedersi.** Oggi l'errore viene inghiottito:
la giornata si salva, i fatti no, e nessuno lo dice. Deve passare
dall'avviso di sempre.

**b) L'ordine delle scritture cambia.** Oggi si cancellano i fatti vecchi e
poi si inseriscono i nuovi: se l'inserimento fallisce, quel giorno resta
senza fatti e sembra tutto a posto. Si inseriscono prima i nuovi, poi si
cancellano i vecchi per id. Se qualcosa si rompe, il peggio che succede e
avere righe in piu - visibili, correggibili - invece di righe perse.

**c) `fact_aliases` si cancella.** Nata ieri, mai letta da nessuno,
sostituita da `fact_decisions`. Una tabella che nessuno usa e un mobile in
una stanza dove non entra nessuno: si toglie, non si lascia.

**d) Le prove.** Le decisioni sono una funzione pura - un elenco di regole
piu un elenco di fatti danno un elenco di fatti - e vanno provate come tale,
senza browser e senza AI: l'ordine di applicazione, i doppioni per coppia,
il "sempre" che non tocca i giorni sbagliati, il "giorno" che non diventa
regola.

## 6. Cosa cambia nella schermata

Il mockup `cosa-ho-capito.html` resta valido tranne in due punti:

1. **"Solo per oggi" ora e mantenibile davvero** - prima era una promessa che
   il primo salvataggio successivo avrebbe cancellato.
2. **Dopo "sempre" arriva la domanda sul passato**, con il numero di righe
   che cambierebbero scritto prima di toccarle.

E una terza cosa che l'audit ha trovato e che il mockup non risolveva: una
giornata raccontata bene produce venti o trenta fatti, e mostrarli tutti in
fila uguali significa che nessuno li guardera. In cima vanno **solo quelli
che meritano un'occhiata** - confidenza bassa, etichette mai viste prima - e
il resto sotto, chiuso.
