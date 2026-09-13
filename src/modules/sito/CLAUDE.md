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

**IL TREMOLIO CHE SI VEDE SOLO SU SAFARI E' UN ALTRO ANIMALE: non e
geometria, e fotogrammi persi.** 13 settembre 2026, Manuel: "trema su
safari", "trema tutto il sito", "fino a poco fa non tremava, e ha
ricominciato con le ultime modifiche".

Come si riconosce dalle altre due qui sopra: se trema UNA cosa (la carta,
il paragrafo) e un difetto di quel pezzo — arrotondamento o deriva. Se
trema TUTTO, comprese sezioni che nessuno ha toccato, non c'e un pezzo
rotto: il browser non sta stando dietro allo scorrimento. Allora non si
cerca il pixel, si cerca cosa costa a ogni fotogramma. E si guarda cosa e
stato aggiunto DA QUANDO non tremava piu, perche il costo e sempre
qualcosa di nuovo.

Le tre cose che costavano, tolte tutte e tre:

1. `.jm-sito12-pista` cambiava il colore di FONDO a ogni fotogramma
   (`background: color-mix(..., var(--buio) ...)`). Sembra una riga
   innocua. Quell'elemento e alto 920svh, cioe piu di ottomila pixel:
   cambiargli il fondo vuol dire ridipingere una superficie enorme
   sessanta volte al secondo. Chrome compone, Safari ridipinge. Adesso e
   una sfumatura FERMA, dipinta una volta. Si puo fare perche la scena e
   alta 100svh, sta incollata fino in fondo alla pista e sotto di lei quel
   fondo non si vede mai — misurato: 0 righe chiare su 249 campionate in
   undici punti attorno alla cucitura.
2. `.jm-sito12-scena::after` e grande quanto lo schermo e cambia opacita a
   ogni fotogramma. L'opacita e la cosa piu economica che si possa
   animare, ma solo se il browser tiene lo strato da parte gia dipinto:
   `will-change: opacity`. Senza, Safari ridisegna la sfumatura ogni
   volta.
3. `scorrimento.tsx` riscriveva `meta[name=theme-color]` a OGNI evento di
   scorrimento, anche per rimetterci lo stesso valore. Su Safari
   `theme-color` non e una proprieta della pagina: e il colore della
   cornice del browser, che vive in un altro processo, e ogni scrittura e
   un messaggio a quel processo. Adesso si scrive solo quando lo stato
   cambia davvero (due volte per scrollata invece di centinaia).

REGOLA: niente puo cambiare a ogni fotogramma su una superficie piu grande
dello schermo. Se deve cambiare, cambia l'OPACITA di uno strato con
`will-change: opacity`, non il colore. E nessun listener di scorrimento
scrive nel DOM quando non c'e niente da cambiare: prima si confronta con
l'ultimo stato, poi si scrive.

Attenzione: questi tre difetti NON si vedono dai banchi, che girano su
Chromium in un contenitore senza schermo. Il banco misura la geometria
(quanti pixel si sposta ogni cosa), e la geometria era giusta. Il costo di
disegno si ragiona, e si verifica su Safari vero.

**SECONDO GIRO SULLO STESSO TREMOLIO, e qui c'era la causa vera.** Con le
tre cose qui sopra tolte, Manuel: "trema su come funziona, si scrive da
sola, fino alla fine dell'animazione del lucchetto". Cioe non tutto il
sito: quella scena, tutta, dal primo titolo all'ultimo fotogramma. Un
sintomo cosi non e un disegno che costa, e il MOTORE che non sta dietro.
Tre difetti nel motore, tutti e tre veri:

1. **`misura()` leggeva e scriveva alternati.** Per ognuno dei ventiquattro
   elementi: `getBoundingClientRect()`, poi `setProperty`. Ogni scrittura
   sporca lo stile, e la misura subito dopo pretende un valore aggiornato,
   quindi obbliga il browser a rifare stile e impaginazione SUBITO.
   Ventiquattro ricalcoli forzati per fotogramma. Chrome non lo paga
   (misurato qui: 0,097ms contro 0,065ms, cioe niente) perche sa che una
   variabile personalizzata non cambia l'impaginazione; Safari quel trucco
   non ce l'ha e invalida il sottoalbero. Ecco perche nessun banco lo
   vedeva. Adesso e in due tempi: prima tutte le misure in un array, poi
   tutte le scritture.
   REGOLA: in un ciclo che tocca il DOM, mai una lettura dopo una
   scrittura. Prima si legge tutto, poi si scrive tutto.
2. **Si riscrivevano tutti e venti i `--p` a ogni fotogramma**, anche i
   diciotto gia inchiodati a 0 o a 1. Per Safari ognuna di quelle e
   un'invalidazione di stile. Adesso si confronta con l'ultimo valore
   scritto: una o due scritture per fotogramma invece di ventiquattro.
3. **Il fotogramma si chiedeva dall'evento di scorrimento.** Su Safari
   quegli eventi non arrivano uno per fotogramma — lo scorrimento vive su
   un altro thread — quindi capitava un fotogramma senza misura (scena
   ferma) e quello dopo con due (salto doppio). Fermo-doppio-fermo-doppio
   e come si vede il tremolio. Adesso il primo evento accende un giro che
   si rimette in coda da solo a ogni fotogramma e si spegne dopo dieci
   fotogrammi fermi: una misura per fotogramma dipinto, sempre. Il ritardo
   su Safari resta ma diventa costante, e un ritardo costante non si vede.

**E il telefono si muoveva ancora con `width`, `left` e `top`.** La carta
era gia passata a `transform` l'11 settembre; il telefono no, ed e il pezzo
piu grande della scena, con due ombre sfocate da 26 e 46 pixel che il
browser ridisegnava alla misura nuova a ogni fotogramma. Il banco lo
vedeva gia senza saperlo: il passo del telefono era "min 0,203px max
0,242px, scarto 0,039" — cioe l'aggancio al pixel intero dell'impaginazione
— e dopo il passaggio a `transform` e "min 0,217 max 0,219, scarto 0,002".
Venti volte piu regolare, su Chromium; su Safari il pixel dell'impaginazione
e piu grosso.

Il passaggio non e diretto, perche `transform` ragiona in unita sue: le
percentuali sono dell'elemento e non della scena, e `scale` vuole un numero
puro mentre in CSS non si puo dividere una lunghezza per un'altra. Quindi
`scorrimento.tsx` MISURA tre numeri a ogni ridimensionamento
(`misuraTelefono`): `--tel-k` (dentro/fuori), `--tel-corsa` (48% della
larghezza della scena in pixel), `--tel-salita` (8% dell'altezza).
Verificato che la coreografia non e cambiata: la posizione e la misura del
telefono coincidono con quelle di prima entro 0,1px in tutti e quattordici
i punti campionati fra --s 0 e --s 0,80.

REGOLA GENERALE, ormai pagata tre volte: **dentro una scena che si incolla,
niente si muove con `top`, `left` o `width`. Solo `transform` e `opacity`.**

**TERZO E ULTIMO GIRO: IL CURSORE NON LO SCRIVE PIU' IL JAVASCRIPT.**
Manuel, dopo i due giri qui sopra: "trema sempre". Aveva ragione, e i due
giri precedenti non potevano bastare — hanno tolto lavoro inutile, ma non
la causa.

La causa e strutturale. Su Safari lo scorrimento vive su un thread suo: la
pagina si sposta li, e il thread principale — dove gira il JavaScript —
viene avvisato dopo. Per quanto si renda leggero quel codice, il numero che
scrive si riferisce sempre a una posizione di scorrimento vecchia di un
fotogramma o due. Se il ritardo fosse fisso non si vedrebbe. Ma dipende da
quanto lavoro c'e in quel momento, quindi oscilla — e un ritardo che
oscilla E' il tremolio. Non e un difetto da correggere: e il limite del
misurare lo scorrimento da JavaScript.

Adesso `--p` e `--s` li scrive il browser, con `animation-timeline`. Due
`@property` (senza, le variabili sono testo e non si interpolano), due
`@keyframes` da 0 a 1, e la finestra giusta:

    --p   `cover 0%` -> `cover 100%` (la finestra predefinita di view())
          identico a (H - top) / (H + altezza)
    --s   `contain 0%` -> `contain 100%`
          identico a (0 - top) / (altezza - H)
    --s con data-pista="avanti": `contain -55vh contain 100%`
          il -55vh e l'`H * 0.55` del JavaScript

Non e cambiata una riga di coreografia: tutto il CSS era gia scritto in
funzione di quelle due variabili, e cambia solo chi le scrive.

**Provato, non dedotto.** Il banco confronta il valore nativo con la
formula di prima a ogni 211 pixel per tutta la pagina: scarto massimo
0,000005 su tutte e quattro le piste. E il passo del telefono, che era
0,039px di scarto a marzo e 0,002 dopo il passaggio a `transform`, adesso e
**0,000**. Confronto a pixel di 69 fotogrammi con la versione di prima: 54
identici, 15 diversi al massimo dello 0,65% dei pixel, ed e un pixel di
sfasamento della deriva del testo — invisibile, e piu corretto di prima
(vedi sotto).

**LE QUATTRO ESCLUSIONI, e la ragione e una sola.** `view()` misura dove
sta il blocco NELL'IMPAGINAZIONE; `getBoundingClientRect()` misura dove sta
DOPO essere stato spostato. Per quasi tutti e la stessa cosa. Non lo e per
chi vive dentro una scena incollata — il blocco e inchiodato allo schermo
mentre la sua casella continua a scorrere — e li i due numeri divergono
fino a mezzo cursore (misurato: 0,598 su `.jm-sito8-testa`, 0,586 su
`.ft`, contro 0,000 di `.jm-sito9-intro` e `.jm-sito-banda`). Il numero
giusto e quello vecchio, perche e su quello che la coreografia e stata
regolata: `[data-pista] [data-fx]` e `.jm-sito-banda .ft` hanno
`animation-name: none` e tornano al JavaScript, che se ne riprende carico
da solo.

Gli altri blocchi differiscono al massimo di 0,018, e sono i 14px di
deriva del testo: la misura vecchia comprendeva lo spostamento che lei
stessa provocava, un cane che si morde la coda. La nuova no.

**SOLO SOPRA I 901px.** La finestra `contain` esiste solo se la pista e
piu alta dello schermo; sul telefono `jm-sito12-pista` e alta `auto` e puo
essere piu bassa, e li si rovescerebbe. Sul telefono continua a scrivere il
JavaScript (verificato: 0/4 piste native a 390px, `--s` che avanza
regolare), che li non ha mai dato problemi.

**LE RETI.** `@supports (animation-timeline: view())` spegne tutto dove il
browser non sa farlo, e li scrive il JavaScript come sempre. Dove sa farlo,
le animazioni CSS battono lo stile in linea nella cascata, quindi vincono
loro comunque; e `scorrimento.tsx` chiede a ogni elemento se ha addosso
un'animazione di nome `jm-sito7-cursore`/`jm-sito7-corsa` e smette di
misurare quelli che ce l'hanno. `prefers-reduced-motion` esce prima che
venga messo `data-js`, quindi li non si accende niente, come prima.

Il banco difende due cose separate (`verify-scorrimento-fluido`, 12/12):
che le animazioni ci siano davvero — basta una regola nuova che dichiari
`animation` su quei selettori per spegnerle in silenzio — e che il numero
coincida con la formula. Se un giorno si aggiunge una pista, si aggiunge
al conto delle quattro.

Nota sui banchi: subito dopo aver salvato il CSS, `verify-v7` puo uscire
rosso una volta perche il server di sviluppo sta ancora ricompilando.
Rilancialo: se e verde tre volte di fila, era la ricompilazione.

Nota su Playwright in locale: i banchi puntano a `http://localhost:3100`.
Con `http://127.0.0.1:3100` la pagina si carica ma NON si idrata
(`data-js` non arriva) e si misura la versione senza JavaScript, che e
tutta un'altra cosa. Usa `localhost`.

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
ancora scritta**: oggi arrivano e restano in tabella. E il prossimo passo
di questo modulo.
