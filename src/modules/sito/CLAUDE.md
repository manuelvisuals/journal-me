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
- Banchi prima del push: `verify-sito` e `verify-scorrimento-fluido`
  (piu tsc, eslint, verify-i18n; e `verify-v7` ogni volta che si tocca il
  CSS del sito).

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

**Dal 12 settembre 2026 la regola ha una deroga, e va letta insieme.**
Manuel ha chiesto una modifica al DESKTOP (la scena "come funziona", qui
sotto). "Il desktop non si tocca" resta il default, non e piu un divieto:
si tocca quando lo chiede lui, e allora valgono le due regole di sempre
alla rovescia — la regola nuova sta dentro `@media (min-width: 901px)` per
non toccare il telefono, ed esclude comunque l'archivio. `/v7` resta il
metro: dopo ogni modifica al desktop, `verify-v7` deve dire "identico". Se
dice qualcos'altro, non hai cambiato la home: hai cambiato anche
l'archivio.

## La scena "come funziona" (jm-sito12): sul desktop il telefono parte al centro

12 settembre 2026, Manuel: "ora mostra il telefono di lato in partenza e
poi alla fine va al centro; vorrei provarla col telefono al centro in
partenza, poi va di lato e appaiono i fumetti" (mockup di riferimento
`scena-bloccata.html`). **Cambia l'ordine, non i pezzi**: i fumetti
restano identici — misura, schermo dentro, dissolvenza — perche erano gia
stati tarati due volte l'11 settembre ("falli il doppio piu grandi", poi
"spariscono troppo presto"), e ritoccarli sarebbe rifare un lavoro
approvato.

Le due cose da sapere prima di rimettere le mani qui:

1. **La scena non si vede finche non si incolla.** Con
   `data-pista="avanti"` il cursore `--s` parte quando la pista scende al
   55% della finestra, ma lo `position: sticky` morde solo quando la pista
   tocca il bordo alto: su 660svh a 900px sono 495 pixel, cioe `--s` = .09.
   Il primo tentativo faceva partire il telefono a .02 e il quadro
   d'apertura — telefono al centro — non si vedeva mai. Qualunque
   movimento nuovo comincia DOPO quel numero, e quel numero si ricalcola
   se cambia l'altezza della pista.
2. **La pista si e allungata da 500 a 660svh per non pagare l'aggiunta
   con il tempo di lettura.** Ogni carta ha una finestra piu stretta in
   percentuale (.18 invece di .2333) ma piu lunga in pixel (119svh invece
   di 117). Chi accorcia la pista senza rifare questo conto rimette in
   piedi il difetto di cui Manuel si era gia lamentato.

Il telefono fa un viaggio solo, scritto una volta: `(--esci - --centro)`
vale 0 in partenza, 1 mentre e fuori e 0 di nuovo alla fine, e da li
escono larghezza, `left` e `top`. Sotto i 900px non cambia niente: la
coreografia del telefono e quella di prima.

**L'ultimo atto: il lucchetto davanti (13 settembre).** Dopo che il
telefono e tornato al centro con la frase, continuando a scorrere il
telefono si DISSOLVE — non si gira e non viene toccato — e davanti a lui
si forma un lucchetto fatto con i tre punti del marchio: salgono a
triangolo, dal punto in alto scendono i due tratti dell'arco fino ai due
esterni, compare la serratura e l'arco ci scatta dentro. Poi la frase
cambia in `t.prova.chiude`.

Tre cose che conviene sapere prima di rimetterci mano:

- **Perche davanti e non sopra il telefono.** Manuel voleva il lucchetto
  al posto della mela, e poi sul retro di un iPhone vero. Non si puo:
  Apple vieta per iscritto qualunque variazione del suo logo, e sulle sue
  immagini prodotto vieta rotazioni, animazioni, ritagli e sovrapposizioni
  (developer.apple.com/app-store/marketing/guidelines). Il lucchetto che
  finisce di formarsi quando il telefono se n'e gia andato e l'unica
  strada che resta, ed e quella scelta (mockup `retro-lucchetto.html`,
  strada B). Se qualcuno riprova a metterlo sopra il telefono, sta
  rifacendo un giro gia fatto tre volte.
- **La pista e passata da 660 a 920svh, e tutti i tempi precedenti sono
  stati moltiplicati per 660/920 = 0,7174.** In pixel di scorrimento cio
  che c'era prima dura esattamente quanto prima: era la condizione per non
  rimettere in discussione una scena gia approvata. Chi allunga ancora la
  pista rifa la moltiplicazione su TUTTI i numeri, non su alcuni.
- **Non serve una riga di JavaScript.** I tre punti si muovono solo in
  verticale (le x non cambiano mai), quindi bastano tre `translateY` legati
  a `--sali`; l'arco e disegnato con `stroke-dashoffset` su una lunghezza
  di 102, che e mezzo arco misurato con `getTotalLength` (101,69,
  arrotondato per eccesso: un avanzo di tre decimi non si vede, un difetto
  lascerebbe il tratto aperto). Il buco della chiave e una MASCHERA, non
  una toppa color fondo: sotto passa la sfumatura della scena e una toppa
  si vedrebbe; la maschera sta dentro un `<g>` perche la serratura si
  ingrandisce entrando.

Sotto i 901px l'ultimo atto non esiste (`display: none`), e nemmeno con
`prefers-reduced-motion`: e tutto movimento, e fermo non racconta niente.

**Le due sezioni sono diventate una (13 settembre).** Manuel: "quando
appare il lucchetto e continui a scorrere lo sfondo diventa cioccolato e
appaiono le animazioni della cassaforte; di due sezioni ne fai una
lunga". Nel documento restano DUE sezioni — non si e spostato niente, e
sotto i 901px si comportano come prima. Quello che sparisce e la
cucitura:

- `--buio` (.86 -> .97, sulla pista perche li vive `--s`) porta il fondo
  della scena a quello della cassaforte. La ricetta e copiata identica da
  `.jm-sito9-chiave` — sfumatura d'accento al 7% sopra l'inchiostro — e se
  una delle due cambia devono cambiare tutte e due, se no il bordo tra le
  sezioni torna a vedersi.
- La frase finale passa da inchiostro a crema con lo stesso cursore.
- **La fascia chiara che restava in mezzo era un riempimento, e la regola
  che lo mette ha un ID.** Misurato: sezione 2250-10794, pista 2382-10662,
  cioe 132px sopra e 132px sotto, e quelli sotto restavano color crema fra
  il lucchetto sul cioccolato e la cassaforte. Il riempimento arriva da
  `.jm-sito4 #come`: per toglierlo il selettore deve contenere anche lui
  un ID (`... [data-js] #come`), se no la regola c'e e non fa niente. E il
  tipo di errore che si cerca per mezz'ora.

Non serve toccare il fondo della pista con una transizione a parte: la
scena e alta 100svh e resta incollata fino al fondo della pista, quindi
negli ultimi pixel non si scopre mai la crema sotto di lei.

**La frase della cassaforte si prende una schermata (13 settembre).**
Manuel: "non si vede bene perche non sta centrata nella pagina; poi
sparisce e diventa 'Solo tu hai la chiave', che resta fisso, e sotto vedi
l'animazione dei box". Prima era un paragrafo appoggiato sopra la scena:
piccolo dentro una sezione altissima, e quando la scena si incollava
restava in cima insieme al titolo — due frasi nello stesso quadro, e non
si legge nessuna delle due. Adesso e alta `100svh` con la frase al centro,
piu grande, e soprattutto ENTRA ED ESCE col cursore: `--p` di `data-fx`
vale 0,5 quando il blocco riempie lo schermo, quindi entra fra .18 e .36 ed
esce fra .58 e .74. La dissolvenza in USCITA e il punto di tutto. La
transizione a tempo della regola generale va spenta (`transition: none`),
se no ogni pixel di rotella arriva con 0,9 secondi di ritardo.
Sotto i 900px `data-fx` viene neutralizzato (`opacity: 1`): la frase li
resta ferma e visibile com'era.

**REGOLA CHE E' COSTATA UN GIRO: `transition: none` su un blocco
`[data-fx]` non si mette mai da solo.** La regola generale fa derivare quei
blocchi di 14px mentre attraversano lo schermo
(`translateY((--p - .5) * 14px)`). Con la transizione di 0,9s la deriva non
insegue lo scorrimento e non si vede; spenta la transizione diventa un
movimento legato allo scorrimento, scritto dal JavaScript, che arriva un
fotogramma dopo quello della pagina — e il blocco balla contro il resto.
Manuel: "ora trema di nuovo". Misurato: il paragrafo avanzava di 0,993
pixel per pixel di rotella invece di 1,000, cioe i 14px spalmati sui 1992
di corsa. Cura: `--jm-sito7-deriva: 0px` insieme a `transition: none`.
Il banco lo controlla adesso da solo (`verify-scorrimento-fluido`: ogni
blocco `[data-fx]` con transizione a zero deve avanzare di esattamente un
pixel per pixel), e il morso e provato.

**"Solo tu hai la chiave" entra in dissolvenza** (Manuel: "deve apparire in
modo soft con un fade in"): sale da zero nei primi sei centesimi di corsa
invece di essere gia acceso al primo fotogramma. L'uscita verso la seconda
frase non e cambiata.

**IL SITO TIENE SEMPRE I SUOI COLORI, e non e una scelta estetica ma un
difetto riparato** (14 settembre 2026, Manuel: "perche fa schifo con questi
colori strani se imposto il telefono in modalita scura?").

Il sito e l'app dividono la stessa tavolozza, e in scuro due token si
SCAMBIANO: `--jm-bg` da crema (#EDE6DA) a quasi nero (#12100E), `--jm-ink`
da cioccolato (#241C17) a crema (#EFE7DA). Per l'app e giusto. Per il sito
no, e la ragione e questa: **il sito non usa quei due come "fondo e testo",
li usa come MATERIALI**. Il velo sotto la fotografia dell'eroe e cioccolato
trasparente; scambiato diventa crema trasparente, la fotografia si sbianca
e sopra ci restano parole color crema. Il sito non ha mai avuto una
modalita scura: indossava quella dell'app.

La cura sta in `src/themes/boot.ts` (`sitoLuceCss`), non in questo foglio,
e il commento lungo e li. In due righe: sulle pagine del sito la tavolozza
e quella del tema di default in chiaro, sempre. Dentro l'app non cambia
niente.

Le due stranezze di quella regola, spiegate perche non sembrino sciatteria:
`html:has(.jm-sito)` e non `.jm-sito` perche il fondo che si vede facendo
rimbalzare lo scorrimento — e che Safari campiona per la fascia dell'ora —
lo dipinge `<html>`; e `!important` perche lo script di boot scrive i token
come stile IN LINEA su `<html>`, che batte qualunque selettore. Il
`html:has(...)` non e un'invenzione: questo foglio lo usa dal 5 settembre
(riga 808) per la stessa ragione.

Provato: sedici schermate (home IT, home EN, assistenza, archivio /v7; a
390px e a 1440px; in cima e all'85%) confrontate a pixel fra telefono
chiaro e telefono scuro, tutte identiche. E /login e /privacy continuano ad
andare scure. Il banco `verify-sito` guarda tutte e due le meta della
regola — che sul sito i colori non si muovano E che nell'app la modalita
scura funzioni ancora — perche e facile romperne una sola. Provato a
mordere: cambiando il selettore in uno che non esiste il banco passa da
56/60 a 54/60.

Quello che si paga, ed e voluto: chi dentro l'app ha scelto un tema diverso,
sul sito vede comunque i colori di casa.

DIFETTO SEPARATO, TROVATO CERCANDO QUESTO E NON ANCORA RIPARATO: il badge
"Coming to the App Store" dentro `.jm-sito4-store-banner` e scritta scura
su lastra chiara sopra una fotografia scura, e si legge male. NON e un
difetto della modalita scura — e identico in chiaro, verificato — ma e il
badge dell'App Store, quindi vale la pena.

Nota sui banchi: subito dopo aver salvato il CSS, `verify-v7` puo uscire
rosso una volta perche il server di sviluppo sta ancora ricompilando.
Rilancialo: se e verde tre volte di fila, era la ricompilazione.

**La pista lunga ha rotto la precisione di `--s`, e questa e la regola
che ne esce.** Manuel, sull'anteprima: "quando scrollo, tremola in su e
giu, un CLS di pochi pixel". Non era CLS — l'altezza del documento non
cambiava di un pixel, misurato lungo tutta la pagina. Era
l'arrotondamento: `scorrimento.tsx` scriveva `--s` con quattro decimali,
e su 6574 pixel di pista uno scatto vale 0,66 pixel di scorrimento
mentre la carta si sposta di 0,42 pixel per scatto. Un pixel di rotella
avanzava di uno o di due scatti a seconda di dove cadeva
l'arrotondamento, e la carta alternava 0,42 e 0,84 pixel: tremolio.
Adesso i decimali sono sei (scatto = 0,004 pixel).

REGOLA: la precisione di `--s` deve stare sotto il pixel PER LA PISTA
PIU LUNGA del sito, non per quella media. Chi allunga una pista rifa
questo conto. Banco: `node scripts/verify-scorrimento-fluido.mjs`, che
scorre di un pixel per volta e pretende che lo spostamento per pixel non
vari piu di 0,10 (oggi varia di 0,031, che e la quantizzazione a 1/64 di
pixel del browser). Provato a mordere: con quattro decimali lo scarto
sale a 0,422 e il banco diventa rosso.

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
ancora scritta**: la rotta c'e, la schermata no.

### Dal 13 settembre 2026: la pagina e nuda, e il messaggio avvisa

Tre cose insieme, scelte da Manuel sul mockup
`MOCKUP-supporto-e-feedback.html` (1A, 2C, 3C):

1. **La pagina non ha piu la barra del sito.** Solo il marchio e le due
   lingue (`.jm-sito-sup-testata`). Chi apre /support ha un problema, e
   "Inizia ora" gli proponeva di iscriversi mentre cercava aiuto; e il
   revisore di Apple apre questo indirizzo a freddo, perche e il Support
   URL della scheda. Se qualcuno rimette `NavSito` qui, `verify-sito`
   diventa rosso su "la barra del sito NON c'e".
2. **Il messaggio manda un'email** (`server/posta-supporto.ts`, Resend via
   una fetch, nessuna libreria). L'ordine non si inverte: prima si SALVA,
   poi si prova a mandare, e la risposta resta "ok" anche se la posta non
   parte — il messaggio c'e comunque, e chi ha scritto non puo farci
   niente. Serve `RESEND_API_KEY` su Vercel; senza, la rotta funziona
   uguale e il log dice "RESEND_API_KEY assente". Il destinatario di
   fabbrica e `spamming.madh52@gmail.com` e NON e una preferenza: finche
   il mittente e `onboarding@resend.dev`, Resend consegna SOLO alla casella
   del titolare dell'account, e quello e l'account a cui si arriva dal
   GitHub di Manuel (verificato il 14 settembre 2026; l'account di
   Stoqfolio, aidev.madh52@gmail.com, chiede un SMS a un numero che Manuel
   non ha piu). Per liberarlo: verificare dayalogue.com su Resend, poi
   `SUPPORT_FROM_EMAIL`, e allora `SUPPORT_TO_EMAIL` puo essere qualunque
   indirizzo.
3. **Due trappole per i robot, zero clic** (`supporto-regole.ts`, lette sia
   dal modulo che dalla rotta perche in due posti divergerebbero): un campo
   esca fuori campo — non `display:none`, che alcuni robot saltano — e
   l'orologio, meno di tre secondi dall'apertura. Chi viene scartato riceve
   "grazie" lo stesso: dirgli che e stato riconosciuto e spiegargli come
   non farsi riconoscere.

`supporto-indirizzo.ts` legge cio che la linguetta Feedback dell'app mette
nell'indirizzo (`email`, `da`, `v`, `s`): la PAGINA li legge e li passa al
modulo come proprieta, cosi il primo render e uguale fra server e client.
Dal telefono la linguetta apre il browser, che e un altro programma: la
sessione dell'app li non esiste, e l'indirizzo e l'unico bagaglio che passa
quel confine. Non e una prova di identita e non ci si fonda niente: e un
campo in meno da riempire.

Banco: `node --experimental-strip-types scripts/verify-supporto-trappole.mjs`
(codice puro, non serve il dev server) piu `verify-sito` come sempre.
