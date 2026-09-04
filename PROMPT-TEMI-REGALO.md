# Prompt da consegnare al Claude dell'amico (regalo dei temi)

Scritto il 4 settembre 2026. Serve a UNA cosa sola: farsi consegnare i temi di un'altra
app in una forma che il contratto dei temi di dayalogue (`SPEC-temi.md`, `src/themes/`)
possa accettare senza indovinare niente.

Manuel copia il blocco qui sotto (tutto, dalla riga `====` in poi) e lo incolla nel Claude
dell'amico. Torna indietro UN file HTML: Manuel lo apre in Safari, spunta i temi che gli
piacciono, preme "Copia i temi scelti" e incolla il risultato qui in chat.

Perche il formato e cosi rigido: `resolveTheme()` in `src/themes/contract.ts` scarta le
chiavi che non conosce e i numeri fuori range, in silenzio. Un tema consegnato "quasi
giusto" non da errore: da un tema che assomiglia al default e nessuno capisce perche.

====

# Regalo: i temi di questa app per dayalogue

Sei nel progetto di un'app. Un amico dell'autore, Manuel, ha un'app diario che si chiama
dayalogue, e l'autore gli sta regalando i temi di QUESTA app.

Il tuo compito non e scrivere codice per dayalogue, e non e modificare questo progetto.
E leggere i temi che esistono qui e consegnarli in UN SOLO file HTML, autosufficiente,
che Manuel apre in Safari per scegliere quali gli piacciono.

## Regola zero, prima di tutto il resto

**Non inventare nessun valore.** Ogni colore e ogni numero deve essere letto dal codice di
questo progetto. Se un valore non esiste qui (per esempio: questa app non ha un tema
chiaro, o non ha un colore "pericolo"), NON riempire la casella con qualcosa di
plausibile: lasciala vuota e scrivilo nelle note del tema.

Il motivo e pratico, non morale. Chi riceve il file non puo distinguere a occhio un colore
letto dal codice da uno inventato bene: entrambi sembrano giusti e passano ogni controllo
automatico. Un buco dichiarato si riempie in dieci minuti a quattro mani; un valore
inventato resta li per anni.

## Cosa consegni

Un file solo: `temi-per-dayalogue.html`.

Vincoli, tutti obbligatori:

- **Autosufficiente.** Nessun `<script src>`, nessun `<link rel="stylesheet">`, nessun
  `@import`, nessun font caricato dalla rete, nessuna immagine esterna. Tutto dentro il
  file, CSS e JS inline. Deve aprirsi con doppio clic in Safari, su un Mac senza rete.
- **Safari 17+**, aperto da `file://`.
- **Niente localStorage / sessionStorage**: da `file://` possono essere bloccati e la
  pagina muore. Tieni lo stato in variabili JavaScript.
- Niente emoji, niente apostrofi tipografici: solo apostrofo ASCII.
- Non allegare il codice sorgente del progetto e non copiare dentro il file niente di
  privato (chiavi, indirizzi, dati di utenti reali, testi veri di qualcuno).

## Cosa deve fare quel file

**In cima:** titolo, nome dell'app di origine, nome dell'autore, quanti temi ci sono, e
una riga che dice a quali condizioni sono regalati (uso libero dentro dayalogue? serve un
credito con il nome dell'autore? va bene anche se dayalogue diventa a pagamento?).

**Una scheda per tema**, e dentro ogni scheda:

1. Nome del tema, e due o tre righe sull'INTENZIONE: cosa deve far sentire, e soprattutto
   cosa NON deve diventare se un domani qualcuno lo "aggiusta". (Esempio vero di dayalogue:
   il tema Malva ha un accento prugna smorzato; se qualcuno ne alza la saturazione il tema
   smette di funzionare. Quella frase li vale piu di venti valori.)
2. **Un'anteprima renderizzata dal vivo** (vedi sotto), in chiaro e in scuro, con un
   interruttore a tre posizioni: chiaro / scuro / affiancati.
3. La tabella dei colori: per ogni modo, i 18 valori, ognuno con un quadratino del colore
   vero accanto al valore testuale.
4. Tipografia, forme, densita: i valori, non una descrizione.
5. **Il referto di contrasto** (vedi sotto): sei coppie per modo, con il rapporto numerico
   e verde/rosso rispetto alla soglia.
6. Una casella di spunta "mi piace".

**In fondo, una barra sempre visibile** con:

- un bottone **"Copia i temi scelti"**: mette negli appunti UN SOLO blocco JSON, l'array
  dei temi spuntati, esattamente nello schema qui sotto;
- un bottone **"Copia tutti"**;
- e, sotto, un `<textarea>` di ripiego sempre presente e selezionabile che contiene lo
  stesso testo. Questo non e un extra: in Safari da `file://` la scrittura negli appunti
  puo fallire in silenzio, e senza il ripiego il regalo non arriva a destinazione.

## L'anteprima: cosa disegnare

Un finto pezzo di app diario, disegnato usando SOLO i valori del tema (nessun colore
scritto a mano dentro l'anteprima: se un elemento ti serve e non c'e un token per lui,
quell'elemento non va nell'anteprima). Deve contenere, come minimo:

- il fondo pagina (`bg`) con dentro il fondo app (`bgApp`), con eventuale `warmth` e `grain`;
- un'intestazione con una data grande (ruolo `display` o `chapter`);
- una scheda (`surface`) con tre paragrafi di prosa finta nel font della prosa
  (ruolo `prose`), piu una riga di testo secondario (`inkMuted`) e una didascalia (`inkFaint`);
- una etichetta maiuscoletta con il tracking positivo (ruolo `label`);
- un bottone primario pieno di `accent` con sopra il testo `onAccent`;
- un elemento secondario su `surface2`, un separatore sottile (`line`), un numero grande
  (ruolo `metric`), un segno di conferma (`success`) e uno distruttivo (`danger`);
- gli angoli presi dai raggi del tema e le spaziature moltiplicate per la densita.

I font: usa quelli veri del tema SOLO se sono gia installati sul Mac, quindi dichiarali
come stack CSS con un ripiego onesto (per esempio
`font-family: "Newsreader", Georgia, "Times New Roman", serif`). **Non caricare font dalla
rete e non incorporare woff2 in base64.** Scrivi accanto all'anteprima, a parole: "il font
vero e X; se non ce l'hai installato stai vedendo Y". Serve perche altrimenti si giudica
un tema guardando Georgia e non ce ne si accorge.

## Lo schema: il contratto dei temi di dayalogue

Un tema di dayalogue e **dati, mai codice**. Niente CSS libero, niente `url()`, niente
stringhe che finiscano in uno `style` senza passare da un validatore. Le chiavi che non
sono in questo elenco vengono scartate; i numeri fuori range vengono scartati; e in
entrambi i casi **in silenzio**, senza errore. Quindi rispettare i range non e pignoleria:
e l'unica cosa che distingue un tema importato da un tema che assomiglia al default.

Ogni tema e un oggetto con questa forma esatta:

```json
{
  "id": "kebab-case-senza-spazi",
  "name": "Nome leggibile",
  "author": "Nome dell autore",
  "space": 1.0,
  "motion": { "press": 0.97 },
  "typography": {
    "fontUi": "inter",
    "fontProse": "newsreader",
    "sizes": {
      "display": 40, "chapter": 28, "pageHeader": 24, "headline": 26,
      "title": 21, "prose": 19, "body": 14, "meta": 12, "label": 11, "metric": 32
    },
    "weights": { "headline": 600, "prose": 400, "label": 650, "metric": 300 },
    "tracking": { "headline": "-0.022em", "label": "0.06em" },
    "lineHeight": { "display": 1.1, "editorial": 1.2, "prose": 1.6, "body": 1.45 }
  },
  "shape": {
    "radius": { "sm": 8, "md": 12, "lg": 16, "xl": 20, "pill": 999, "circle": "50%" },
    "borderWidth": { "hairline": 1, "strong": 2 }
  },
  "light": { "...i 18 valori..." },
  "dark":  { "...i 18 valori..." }
}
```

### I 18 valori di un set di colori (uguali per `light` e per `dark`)

| chiave | cosa e |
|---|---|
| `bg` | fondo esterno della pagina |
| `bgApp` | fondo dell'app |
| `surface` | schede, campi di testo |
| `surface2` | superficie sollevata |
| `ink` | testo primario |
| `inkMuted` | testo secondario, prosa |
| `inkFaint` | didascalie, etichette, suggerimenti |
| `accent` | l'unico colore che parla |
| `accentPressed` | stato premuto |
| `accentHi` | hover, decorazioni, capolettera |
| `onAccent` | testo sopra l'accent (si dichiara, non si indovina) |
| `success` | conferma, obiettivo raggiunto |
| `danger` | distruttivo |
| `line` | il filo sottile che separa |
| `shadow` | colore base delle ombre (nero nei temi scuri, bruno nei chiari) |
| `glow` | colore degli aloni. `"transparent"` li spegne tutti |
| `warmth` | i gradienti di calore del fondo, oppure `"none"` |
| `grain` | opacita della grana, numero da 0 a 0.08. `0` = via |

Non esistono altri colori. Tutto il resto (fondi tinti, bordi colorati, alette) dayalogue
lo ricava da questi con `color-mix`. Se nel tema di origine ci sono venti colori, il lavoro
e proprio ridurli a questi diciotto e dire nelle note cosa e andato perso.

### Formati ammessi per i colori

Ammessi: `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`,
`oklch(...)`, `transparent`.

**Non ammessi** (vengono scartati in silenzio): nomi CSS come `white` o `tomato`,
`color-mix(...)`, `var(...)`, qualunque funzione diversa da quelle sopra.

**Preferenza forte:** i tredici colori veri (da `bg` a `danger`) vanno dati come
`#RRGGBB`. Il validatore di contrasto di dayalogue sa leggere solo esadecimale e `rgb()`:
un colore in `oklch()` entra nell'app ma **non e misurabile**, quindi quel tema non puo
essere certificato. `line`, `shadow` e `glow` possono stare in `rgba()`.

`warmth` accetta solo la stringa `"none"` oppure uno o piu `radial-gradient(...)` separati
da virgola. Nient'altro passa.

### I range: fuori da qui il valore viene ignorato

```
space                    0.7  ..  1.4      (0.88 denso, 1 normale, 1.15 arioso)
motion.press             0.9  ..  1        (1 = nessun feedback al tocco)

sizes.display             24  ..  64       sizes.body       11 .. 18
sizes.chapter             18  ..  44       sizes.meta        9 .. 15
sizes.pageHeader          16  ..  36       sizes.label       8 .. 14
sizes.headline            15  ..  36       sizes.metric     18 .. 44
sizes.title               14  ..  30
sizes.prose               13  ..  26

weights.headline         300  .. 800       weights.label   400 .. 800
weights.prose            300  .. 700       weights.metric  200 .. 700

tracking.headline / label   stringa in em, es. "-0.018em" oppure "0.22em"

lineHeight.display       0.9  .. 1.4       lineHeight.prose  1.3 .. 2
lineHeight.editorial       1  .. 1.5       lineHeight.body   1.2 .. 1.8

radius.sm                  0  .. 24        radius.xl         0 .. 40
radius.md                  0  .. 28        radius.pill       0 .. 999
radius.lg                  0  .. 32        radius.circle     solo "50%" oppure "0px"

borderWidth.hairline     0.5  ..  2        borderWidth.strong  1 .. 4
grain                      0  .. 0.08
```

Nota su `sizes`: sono **ruoli**, non misure di un componente. Il tema non decide "il
titolo della scheda e 18px": decide "quanto e grande il ruolo prosa". Se nel progetto di
origine una dimensione non corrisponde a nessuno di questi dieci ruoli, non forzarla:
mettila nelle note.

### I font

dayalogue non scarica font dalla rete (deve funzionare offline dentro l'app iOS). I font
sono committati nel bundle, e un tema puo scegliere **solo** uno di questi id:

```
inter                 UI, sans neutro
dm-sans               UI, sans geometrico e caldo
ibm-plex-mono         monospaziato
newsreader            prosa, serif moderno
spectral              prosa, serif
eb-garamond           prosa, serif classico
cormorant-garamond    prosa, serif ad alto contrasto (da 21px in su)
```

Se il font vero del tema **non e in questo elenco** (caso probabile e del tutto normale):

1. metti in `fontUi` / `fontProse` l'id piu vicino fra questi sette;
2. e dichiara il font vero nelle note del tema (vedi sotto), con: nome esatto della
   famiglia, da dove viene (Google Fonts, fontsource, una fonderia a pagamento, ...),
   licenza, se e variabile o a pesi fissi, quali pesi usa il tema.

Non provare a incorporare il font: la decisione se aggiungerlo al bundle di dayalogue la
prende Manuel dopo, e dipende dalla licenza e dai kilobyte.

### Il referto di contrasto

Calcola nel file, in JavaScript, il rapporto WCAG (luminanza relativa) per queste sei
coppie, **su tutti e due i set**, e mostralo con il numero e verde/rosso:

```
ink / bgApp          >= 4.5
ink / surface        >= 4.5
inkMuted / surface   >= 4.5
inkFaint / surface   >= 4.5
onAccent / accent    >= 4.5
accent / bgApp       >= 3.0
```

Un tema che fallisce **non va corretto da te di tua iniziativa**: mostralo rosso, col
numero, e scrivi nelle note di quanto manca. dayalogue rifiuta i temi che non passano, ma
la correzione la fa l'autore, non chi importa: cambiare un colore per far passare un
numero e il modo piu rapido per rovinare un tema che funzionava.

Se un tema fallisce solo perche il colore e in `oklch()` e non misurabile, dillo
esplicitamente invece di dare un rapporto finto.

### Se un tema ha un modo solo

Se questa app ha temi solo scuri (o solo chiari): **non inventare l'altro set invertendo
la luminanza.** Invertire produce sempre un risultato mediocre, e un tema mediocre in una
delle due modalita e un tema rotto per meta degli utenti. Metti l'altro set a `null`,
segna `"soloModo": "dark"` (o `"light"`) nelle note, e basta: quel set lo disegnera Manuel
con il suo Claude, partendo dall'intenzione che hai scritto tu.

### Le note di ogni tema

Accanto al JSON di ogni tema, dentro lo stesso oggetto, una chiave `note` con questa forma:

```json
"note": {
  "intenzione": "cosa deve far sentire il tema, e cosa non deve diventare",
  "fontReale": { "ui": "...", "prosa": "...", "licenza": "...", "variabile": true, "pesi": [400, 600] },
  "assenti": ["elenco dei valori che in questo progetto non esistono"],
  "persi": ["cosa c e nell originale e non entra nei 18 colori o nei 10 ruoli"],
  "soloModo": null,
  "sorgente": "dove vivono questi valori in questo progetto: file e nomi dei token originali"
}
```

`sorgente` e importante quanto i colori: se una mappatura e sbagliata, e l'unica cosa che
permette di accorgersene e correggerla senza rifare tutto da capo.

## Formato di uscita dei bottoni "copia"

Un solo blocco JSON, questa forma:

```json
{
  "daApp": "nome dell app di origine",
  "autore": "nome",
  "licenza": "a che condizioni sono regalati",
  "dataEstrazione": "2026-09-04",
  "temi": [ { "...un tema completo, note incluse..." } ]
}
```

Niente testo prima o dopo, niente commenti dentro il JSON: quel testo viene incollato
dentro un'altra chat e letto da una macchina.

## Ricapitolando, l'ordine di lavoro

1. Trova dove vivono i temi in questo progetto e leggili davvero (non a memoria).
2. Mappa i valori originali sui 18 colori, sui 10 ruoli tipografici, sulle forme e sulla
   densita. Ogni volta che una cosa non entra, e una riga in `persi` o in `assenti`, non
   un valore inventato.
3. Calcola i sei contrasti per modo.
4. Scrivi l'unico file `temi-per-dayalogue.html` con le anteprime vive, le spunte, i due
   bottoni di copia e il textarea di ripiego.
5. Apri il file e controlla davvero che: si apra senza rete, le anteprime cambino con
   l'interruttore chiaro/scuro, la spunta cambi cosa esce dalla copia, e il JSON copiato
   sia JSON valido. Non dire che e pronto prima di averlo visto funzionare.
