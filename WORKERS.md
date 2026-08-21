# Lavorare in parallelo su Journal.me

Due o tre chat che lavorano insieme sullo stesso repo. Serve a andare piu veloce, ma
funziona solo se non si pestano i piedi. Questo file e il protocollo.

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

Coppie sicure oggi:

| Worker | PR | File che tocca |
|---|---|---|
| A | 1 `api-auth` | `src/app/api/**`, `src/lib/api.ts`, `src/lib/server/**`, `supabase/migrations/006_*` |
| B | 0 `temi` | `src/app/globals.css`, `src/themes/**`, `src/app/layout.tsx`, i `.tsx` solo per togliere valori letterali |

Sovrapposizione: nessuna. `layout.tsx` lo tocca solo B.

Coppie da **non** mettere in parallelo:
- PR 1 e PR 2: si incontrano in `src/lib/data/entries.ts` (le fetch alle route AI).
- PR 0 e qualunque PR visiva (6, 7, 9, 10): il senso della PR 0 e arrivare prima di loro.

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
