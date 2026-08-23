# Lavorare in parallelo su Journal.me

Due o tre chat che lavorano insieme sullo stesso repo. Serve a andare piu veloce, ma
funziona solo se non si pestano i piedi. Questo file e il protocollo.

**Dal 23 agosto 2026 questo protocollo e VINCOLANTE, non un consiglio** (decisione di
Manuel, ARCHITETTURA.md). La divisione del lavoro non si inventa piu volta per volta:
un worker = un MODULO della mappa in ARCHITETTURA.md §2, e il suo perimetro e scritto
nel CLAUDE.md della cartella del modulo. Il prompt per aprire un worker nuovo e
`PROMPT-WORKER.md`.

## Regola numero uno: nessun worker tocca `main`

Ogni worker lavora su un branch suo e pusha quello. Manuel apre la pull request su GitHub
e fa merge quando il worker ha finito. Sono due click, e sono l'unica cosa che impedisce
a due chat di sovrascriversi a vicenda.

```
worker-a-api-auth
worker-b-temi
```

Se un worker pusha su `main` mentre un altro sta lavorando, il secondo si trova il push
rifiutato, prova a risolvere da solo, e li si perde un'ora. E successo a tutti.

## Regola numero due: file disgiunti, dichiarati in anticipo

Prima di far partire due worker, guarda quali file toccano. Se due elenchi si
sovrappongono, quei due lavori **non vanno in parallelo**: vanno in fila.

La divisione oggi e quella dei MODULI (ARCHITETTURA.md): il prompt vivo per aprire un
worker e **`PROMPT-WORKER.md`**. Il vecchio `PROMPT-sorella.md` (in `docs/storia/`) resta
come esempio storico di una divisione fatta a mano, prima dei recinti. Da notare due invenzioni che valgono per qualunque coppia futura:

- **`src/app/features.css`**, importato in cima a `globals.css`: il worker nuovo scrive
  solo li, e `globals.css` resta di chi lo aveva gia in mano.
- **`src/lib/i18n/en-extra.ts`**, consultato da `t()` prima del catalogo grande: le
  traduzioni nuove non toccano `en.ts`.

Sono **punti d'innesto**: file vuoti creati apposta perche due sessioni scrivano vicino
senza scrivere nello stesso posto. Quando apri un fronte nuovo, chiediti se serve
un innesto invece di far condividere un file grosso. Un conflitto in un foglio di stile
non da nessun errore, da una schermata storta; in un catalogo di traduzioni perde righe
in silenzio.

Regola generale per scegliere le coppie: prendi da `HANDOVER.md` §13 la tabella di cosa
manca, scrivi per ognuno l'elenco dei file, e metti in parallelo solo gli elenchi che non
si intersecano. Se si intersecano e non puoi creare un innesto, quei due lavori vanno in
fila.

## Regola numero tre: si ferma a uno stato pulito, non a meta

Se il tempo finisce, un worker deve committare **un pezzo che funziona**, non il refactor
a meta. Meglio "ho tokenizzato solo colori e raggi, gli spazi no" che un `globals.css`
mezzo convertito che fra tre settimane nessuno sa piu dove stava.

## Come scrivere un bug a un worker

Un bug scritto male costa due giri di domande. Copia questo blocco e riempilo:

```
BUG

Dove:      (schermata / route, e se conta: tema, chiaro o scuro, desktop o telefono)
Browser:   (Chrome / Safari, oppure app iOS)
Cosa ho fatto:
  1.
  2.
  3.
Cosa e successo:   (il testo esatto che vedi, non un riassunto. Screenshot se c'e)
Cosa mi aspettavo:
Da quando:         (sempre / da un commit preciso / prima funzionava)
Console:           (se sai aprirla: gli errori in rosso. Altrimenti scrivi "non guardata")

Non dichiarare risolto senza averlo visto risolversi. Se non riesci a riprodurlo, dillo
e strumenta il codice invece di ipotizzare.
```

Le tre cose che fanno la differenza, in ordine:

1. **Il testo esatto dell'errore.** "Dice che non trova la giornata" fa perdere un giro;
   `Nessuna giornata per 2026-08-17` lo fa cercare nel punto giusto.
2. **Da quando.** "Prima funzionava" e l'informazione piu potente che esista: riduce la
   ricerca al diff fra due commit.
3. **Un caso solo per messaggio.** Tre bug in un messaggio diventano tre mezze indagini.

Un bug che non sai riprodurre e comunque da segnalare: scrivilo con "non riproducibile a
comando, successo N volte", e lascia che sia il worker a metterci le sonde.
