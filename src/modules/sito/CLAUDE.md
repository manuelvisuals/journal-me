# Modulo SITO

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Il sito pubblico su **dayalogue.com**: la home che spiega il prodotto e
`dayalogue.com/support`. E l'unico modulo che NON e una schermata dell'app:
vive fuori dal guscio (niente splash, niente cancello, niente rail) e la
sua unica ragione d'essere e farsi trovare e far entrare.

Nato il 31 agosto 2026 (mockup `design/mockups/sito-seo.html`); rifatto il
5 settembre 2026 sul mockup `design/mockups/sito-v2.html`: si apre e basta,
la cassaforte al centro, l'AI in regalo, le fotografie (`public/sito/`).
Il badge App Store si accende con `APP_STORE_URL` in `components/home.tsx`.

**Dal 6 settembre 2026 la home e la 2.0** (eroe chiaro con l'iPhone
fotografato, poi la giornata mostrata grande), su istruzioni dirette di
Manuel. La precedente e CONGELATA su `/v1` e `/en/v1` (`home-v1.tsx`, le
due pagine `src/app/v1`, il link in fondo al piede, `piede.precedente` e
`piede.nuovo` in testi.ts, `/v1` nel robots): tutto TEMPORANEO, da
cancellare quando la 2.0 e approvata. Le classi nuove hanno prefisso
`jm-sito2-` e non toccano le vecchie, cosi la v1 resta identica.

- Pagine di `src/app/` di questo modulo: `page.web.tsx`, `en/page.web.tsx`,
  `support/page.web.tsx`, `en/support/page.web.tsx`, piu `robots.ts`,
  `sitemap.ts` e i gusci `api/sito/seo/` e `api/sito/supporto/`.
- Prefisso CSS: `jm-sito`.
- Banchi prima del push: `verify-sito` (piu tsc, eslint, verify-i18n).

## Dall'11 settembre 2026: solo telefono, e /v7 e il metro

Manuel ha approvato il sito **desktop** e ha chiesto di congelarne una
copia: e `/v7` (`components/home-v7.tsx`, pagine `src/app/v7` e
`src/app/en/v7`, link in fondo al piede). Da quel giorno **le modifiche si
fanno solo sulla versione telefono, e il desktop non si tocca**.

In pratica, per ogni regola nuova:

1. sta dentro `@media (max-width: 900px)` — se ne sta fuori, cambia anche il
   desktop, ed e proprio cio che non si deve fare;
2. esclude l'archivio: `.jm-sito7:not(.jm-sito4-archivio-v7) ...`.

La seconda e quella che si dimentica. `/v7` NON e una copia a parte del CSS:
usa lo stesso foglio e le stesse classi della home viva — e l'unico modo per
avere un archivio che si comporta davvero come il sito di quel giorno,
animazioni comprese — quindi una regola che non lo esclude lo cambia insieme
alla home. Non da errore da nessuna parte: /v7 comincia semplicemente a
somigliare alla home viva invece che a se stesso.

Per questo c'e un banco: `node scripts/verify-v7.mjs` (col sito in ascolto)
impronta posizione e misura di 23 pezzi di /v7 a 1440x900 e 393x852 e le
confronta con `scripts/verify-v7.impronta.json`. Se qualcosa si e mosso lo
dice e mostra cosa. Quando il cambiamento e voluto — cioe quasi mai — si
risalva con `--scrivi`.

## La prima schermata sul telefono (jm-sito14)

La home del telefono, dall'11 settembre 2026, non e piu "una pagina con una
foto dietro" ma **una fotografia con una didascalia sopra**: foto a tutta
pagina, occhiello-titolo-testo-tasto in basso a sinistra, un gesto solo.

**Il fondo sotto le parole e la fotografia velata, non una fascia di
colore.** E' la correzione del 11 settembre: avevo provato a mettere la foto
in una fascia alta con sotto il fondo scuro, e Manuel ha risposto — con
ragione — che c'era "troppo layer color cioccolato". Se qualcuno rimette una
fascia, ha rifatto l'errore.

Un numero regge il taglio, e conviene saperlo prima di toccarlo. La foto
`salotto-voce.webp` e 1920x1081 (larga 1,78 volte l'altezza); uno schermo di
telefono e alto 2,17 volte la larghezza. Con `cover` il browser la
ingrandisce fino a coprire l'altezza e se ne vedono 1081 x 393/852 = **499
pixel di larghezza, il 26%**. In 499 pixel non ci stanno insieme la spalla e
il telefono (ne servirebbero 751): **si sceglie**. Si tiene il gesto —
orecchio, viso, mano, telefono — che va da 1140 a 1639, cioe esattamente
499, e da li `object-position: 80%`. Non c'e margine, e il margine non si
crea spostando il taglio.

Il velo e in due pezzi e il secondo non e decorazione. Col solo velo
verticale abbastanza leggero da non spegnere la fotografia, l'occhiello
misurava 2,5 di contrasto e il titolo 4,1 — sotto soglia — perche le loro
code finiscono sul collo e sulla mano, le zone piu chiare. Scurire tutta la
fascia bassa li alzava ma rifaceva la tenda di cioccolato. L'ellisse
agganciata in basso a sinistra scurisce solo il quarto dove stanno le
parole: **occhiello 3,2, titolo 4,9, sottotitolo 8,9, link 12,0**, e la
fotografia a destra resta luminosa. Chi cambia velo o inquadratura rimisura
questi quattro numeri.

**La fascia dell'ora di iPhone.** Trasparente davvero non si puo dentro
Safari: quella striscia e cromo del browser e viene sempre dipinta di un
colore pieno. Lo e solo nell'app installata in schermata Home
(`black-translucent` + `viewport-fit: cover` in `src/app/layout.tsx`, gia
acceso). Quello che si fa e toglierle il contrasto: finche la pagina e in
cima prende `#60554b`, il tono medio dei primi pixel della fotografia
velata, e appena si scende torna `--jm-ink`. Va scritto in **due posti**,
perche i Safari non sono d'accordo fra loro: il meta `theme-color`
(`scorrimento.tsx`) e il colore di `body::before` (qui in styles.css), che
e quello che Safari 26 campiona. Se cambia l'inquadratura o il velo, quel
numero si rimisura e si cambia in tutti e due.

**La barra scrollata e vetro, e basta quello (11 settembre).** Prima era
inchiostro al 90%: la sfocatura c'era ma non aveva niente da sfocare. Ora
il colore lo mette `brightness()` **dentro** il backdrop-filter, che
scurisce cio che passa sotto invece di coprirlo; la tinta resta ma al 42%,
e `saturate` impedisce che sotto il vetro diventi tutto grigio. I due
numeri — `brightness(.40)` e tinta 42% — sono misurati sul caso peggiore,
che e la sezione CREMA: li il marchio avorio sta a 4,2 di contrasto (a
.58/30% scendeva a 2,9 e si sbiadiva). Sulla fotografia sta a 11,4.

Forma, altezza e posizioni **non si toccano**. Ci ho provato — capsula
staccata dai bordi, a pillola, con l'ombra, alla iOS 26 — e Manuel l'ha
bocciata in un colpo: "mi fa schifo a pill cosi, dovevi solo farlo
trasparente". Il vetro qui e un materiale, non una forma nuova.

**Le due trappole gia pagate, per non ripagarle:**

- `.jm-sito2-eroe` sul telefono e `display: block`: `align-items` e
  `justify-content` li non fanno niente. Per appoggiare la colonna in fondo
  va reso `flex` in colonna — e allora serve `width: 100%` su
  `.jm-sito2-eroe-in`, perche `.jm-sito-cont` porta `margin-inline: auto` e
  un margine automatico sull'asse trasversale annulla lo stiramento
  (identico inciampo di `.jm-sito8-scena`).
- `scorrimento.tsx` mette `data-js` dentro un effetto, e **non lo mette
  affatto se il sistema chiede meno animazioni**. In quello stato — che e
  anche il primo disegno di ogni visita — la pilla del rituale resta
  assoluta a 22 pixel dal fondo e finisce sotto la didascalia. Non si
  risolve dando aria alla colonna: quel riempimento sparirebbe
  all'idratazione e le parole scenderebbero di 182 pixel sotto gli occhi di
  chi guarda (vale quasi 0,09 di CLS da solo). Si spegne la pilla, che
  essendo fuori flusso non muove niente ne prima ne dopo. **Regola
  generale: sul telefono nessuna misura che si vede nella prima schermata
  puo dipendere da `[data-js]`.**

Misure buone (393x852, build di produzione, rete a 1,6 Mbps / 150 ms / CPU
x4, cache fredda): CLS **0,0005** sul telefono e **0,0010** sul desktop;
nessuno scorrimento laterale a 375, 393, 430, 744 e 900; zero errori in
console.

## Le tre regole che non si toccano

**1. Server, non client.** Le pagine sono componenti SERVER. Cio che scarica
un motore di ricerca deve essere gia la pagina finita: titoli, paragrafi,
domande e risposte, link. L'unico pezzo che si idrata e il modulo di
assistenza, perche li si scrive. Se un giorno una schermata del sito
diventa `"use client"`, il banco lo becca (controlla il testo dentro
l'HTML grezzo, senza browser).

**2. Le parole del sito NON passano da `t()`.** E l'unica deroga alla
regola 4 di AGENTS.md in tutto il progetto, ed e motivata: `t()` risponde
italiano finche React non si e idratato (HANDOVER §13.11), quindi su `/en`
Google leggerebbe l'italiano. I testi stanno in `testi.ts`, gia scritti
nelle due lingue, e la lingua la decide l'INDIRIZZO — `/` italiano, `/en`
inglese. Il pannello SEO, che invece vive dentro l'app, usa `t()` come
tutti (catalogo in `en.ts`).

**3. Il sito non entra nel pacchetto iOS.** Le pagine si chiamano
`page.web.tsx`: la build mobile accetta solo `.tsx` (`pageExtensions` in
next.config.ts) e le ignora. Senza questo, la prima schermata di chi apre
l'app sul telefono sarebbe una pagina di vendita. Conseguenza gia gestita:
l'export mobile non ha piu un `index.html` di radice, e `npm run build:ios`
lo scrive con `scripts/ios-radice.mjs` (tre righe che mandano a `./app/`).

## Cosa il pannello SEO puo e non puo

Il pannello sta in `/admin` (il modulo ADMIN lo monta dalla porta di questo
modulo) e scrive la tabella `sito_seo` (migration 019) con le stesse regole
delle Aree: lettura pubblica, **nessuna** policy di scrittura, si scrive
solo dalla rotta admin col service role, e chi non e l'amministratore
riceve 404 (`requireAdmin`, ora nello scheletro).

Tocca **il titolo, la descrizione, il titolo e l'immagine per i social e
l'interruttore "fatti trovare"**, per ogni pagina e per ogni lingua. NON
tocca le frasi che si leggono dentro la pagina: quelle sono prodotto, non
impostazioni, e si cambiano come si cambia un prodotto — con un mockup.

Se il database non risponde, la pagina esce lo stesso coi testi di fabbrica
scritti in `seo.ts`. Un sito che va giu perche una tabella di
configurazione tace sarebbe peggio del problema che quella tabella risolve.

## Cosa NON c'e nel sito, e non per dimenticanza

- **Il prezzo.** Il checkout Stripe e pronto ma spento per scelta di Manuel
  (HANDOVER §13): una pagina che dice "4,99 al mese" davanti a un tasto che
  risponde "non ancora" e la stessa bugia del "primo mese incluso" tolta il
  20 agosto. Il prezzo torna il giorno in cui si puo pagare.
- **I termini di servizio nel piede.** Non esistono ancora: un link a una
  pagina che non c'e promette qualcosa che non arriva.
- **Recensioni, numeri di utenti, stelle.** Non ce ne sono.
- **La promessa dell'app iOS.** La domanda risponde "sta arrivando", perche
  l'app non e ancora sull'App Store.

## Le richieste di assistenza

Il modulo di `/support` scrive nella tabella `supporto` passando da
`/api/sito/supporto`, che e **pubblica** (chi chiede aiuto spesso non ha un
account, e a volte scrive proprio perche non riesce ad averlo). Per questo
tutto il resto e stretto: tetti su ogni campo scritti anche nello schema,
immagini solo JPEG in data URL ridotte dal browser, e un tetto per
indirizzo IP che e una porta, non un muro (vive nella memoria
dell'istanza; su piu istanze uno che ci tiene passa — sta scritto anche
nel file, perche nessuno si creda protetto piu di quanto sia).

Le richieste si leggono dalla stessa rotta in GET, che invece e solo
dell'amministratore. **La schermata che le mostra dentro /admin non e
ancora scritta**: oggi arrivano e restano in tabella. E il prossimo passo
di questo modulo.
