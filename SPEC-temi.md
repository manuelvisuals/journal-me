# SPEC · Temi — il contratto dei token

Sottosistema di `SPEC-v2.md`, dove figura come **PR 0**: va fatto prima di tutto il resto.
Scritta il 17 agosto 2026 su `main` a `d1da4ef`.

Mockup: `design/mockups/temi.html` — Minimal e Malva a schermo intero, i cinque temi in
coppia chiaro/scuro, e Altro > Aspetto con lo switch dell'appearance.

**Nota su come verificare i mockup nel sandbox.** Il sandbox non raggiunge
`fonts.googleapis.com` (HANDOVER §12), quindi un mockup che carica i font da Google
renderizza in **Georgia e nel sans di sistema**, e ogni giudizio sui font che ne esce e
falso — sembra funzionare, e non lo e. Per verificare davvero: `npm install` dei pacchetti
`@fontsource*`, e iniettare le `@font-face` con `page.addStyleTag()` puntando ai woff2
locali prima dello screenshot. La controprova che i font siano entrati e misurare la
larghezza dello stesso testo e confrontarla con Georgia: se e identica, non sono entrati.
`document.fonts.check()` **non** e una prova: torna `true` anche col fallback.

---

## 1. Perche prima e non dopo

La regola operativa e questa: **il grosso dei componenti nuovi nasce nelle PR 6-10**
(shell desktop, editor, griglia mese, muro premium). Se il contratto dei token arriva dopo,
quei componenti nascono con valori letterali dentro e poi vanno riscritti. Fare i temi per
primi non e perfezionismo: e evitare di scrivere due volte la stessa UI.

Il costo e piu basso di quanto sembri, perche il lavoro e concentrato in un punto solo.
Misurato sul codice attuale:

| Dove | Cosa c'e |
|---|---|
| `src/app/globals.css` | 2.458 righe, **285 classi**, 166 colori letterali, 592 px letterali, 90 `font-size`, 61 `border-radius`, 38 `box-shadow`. Ma gia **240 usi di `var(--color-*)`** |
| `src/**/*.tsx` | solo **23** colori letterali in 8 file, e **23** classi Tailwind con valore arbitrario |

Cioe: i componenti sono quasi puliti, il lavoro sta quasi tutto in un file. E dei 166 colori
letterali in `globals.css` la grande maggioranza sono varianti in alpha dello stesso ambra
(`rgba(227,161,95,.28)` e simili), che spariscono tutte con `color-mix` (§4).

---

## 2. Due cose diverse che non vanno confuse

**Il motore dei temi** e infrastruttura: un elenco chiuso di token, un modo di applicarli,
un default. E PR 0, e serve comunque anche se nessuno cambiera mai tema, perche e cio che
rende possibile la light mode, l'accessibilita e qualsiasi restyle futuro senza toccare 285
classi a mano.

**Il marketplace dei temi** e una funzione di prodotto: temi fatti da altri, installabili.
Arriva dopo il pagamento (PR 12+), perche introduce distribuzione, moderazione e una
superficie di rete che in modalita locale non puo esistere (§8).

Costruire il primo non impegna a costruire il secondo. Costruire il secondo senza il primo
e impossibile. Quindi: motore adesso, marketplace quando il resto sta in piedi.

---

## 3. Il ruolo del brandbook cambia, e va scritto

Oggi `design/brandbook.html` e "il look dell'app". Da qui in avanti diventa due cose:

1. **La specifica del contratto** — quali token esistono, cosa significano, quali regole
   valgono per tutti i temi (gerarchia delle superfici, ruoli tipografici, ritmo).
2. **La definizione del tema `wine`** — i valori concreti del tema di default.

Senza questa distinzione, ogni futura revisione citera il brandbook per bocciare un tema
che e semplicemente diverso, e i temi non nasceranno mai. Va aggiunto un **capitolo 00**
che dice esattamente questo, prima di tutti gli altri.

Corollario pratico: le regole del brandbook che sono **strutturali** restano vincolanti per
tutti i temi (una sola accent che parla, due famiglie di font e non tre, tracking negativo
sulle headline e positivo sulle label, mai sottolineato). Le regole che sono **valori**
diventano il tema `wine` e nient'altro.

---

## 4. Il contratto: elenco chiuso

Un tema fornisce valori per questa lista e per nient'altro. **Chiavi sconosciute: ignorate.
Chiavi mancanti: si eredita dal tema di default.** Queste due proprieta insieme sono cio che
impedisce a un tema scritto male di rompere l'app.

### 4.0 Due assi, non uno

Tema e chiaro/scuro sono **due scelte separate dell'utente**. Non si cambia tema per
accendere la luce: c'e uno switch a parte, in Altro > Aspetto, con tre posizioni
(chiaro / scuro / sistema), e vale per qualunque tema sia attivo.

Da qui la forma del tema:

```ts
type Theme = {
  id: string; name: string; author?: string;
  typography: Typography;   //  \
  shape: Shape;             //   |  condivisi: identici in chiaro e in scuro
  space: number;            //   |
  motion: Motion;           //  /
  light: ColorSet;          //  i 13 colori + elevation/glow/warmth/grain
  dark:  ColorSet;
};
```

Il font, la scala tipografica, i raggi, la densita e la texture **non cambiano** fra chiaro
e scuro: cambiano solo i colori. E per questo che il contratto li tiene separati invece di
avere due temi gemelli — con due temi gemelli, correggere una dimensione di testo
significherebbe correggerla due volte, e prima o poi divergono.

**Un tema deve dichiarare entrambi i set.** Nessuna derivazione automatica del chiaro dallo
scuro: invertire la luminanza produce sempre risultati mediocri, e un tema mediocre in una
delle due modalita e un tema rotto per meta degli utenti. Se un autore vuole pubblicare un
tema solo scuro, lo dichiara (`supports: ["dark"]`) e lo switch mostra il motivo invece di
dare un risultato brutto.

Il `--space` di un tema **non** cambia fra chiaro e scuro. `grain`, `warmth`, `elevation` e
`glow` invece stanno nel `ColorSet`, perche sono fatti di colore: un'ombra nera su fondo
chiaro non e un'ombra, e un glow ambra su carta bianca e sporco. Guarda i temi Wine e
Malva nel mockup: in chiaro hanno `glow: none` e ombre tenui e calde, non nere.

### 4.1 Colore (13 valori, per ciascuno dei due set)

```
bg            fondo esterno della pagina
bgApp         fondo dell'app
surface       card, input
surface2      superficie sollevata
ink           testo primario
inkMuted      testo secondario, prosa
inkFaint      caption, label, hint
accent        l'unico colore che parla
accentPressed stato premuto
accentHi      hover, decorazioni, drop cap
onAccent      testo sopra l'accent (va dichiarato, non indovinato)
success       goal acceso, conferma
danger        distruttivo
shadow        colore base delle ombre (nero nei temi scuri, bruno nei chiari)
```

**Nessun altro colore.** `line`, i fondi tinti, i bordi ambra, i glow: tutti derivati con
`color-mix(in oklab, var(--color-accent) 28%, transparent)`. Questo e il pezzo che riduce
un tema da ~60 valori a 13, e che fa sparire i 166 letterali di `globals.css`.

`color-mix` e supportato da Safari 16.4+, quindi va bene sia sul web sia dentro WKWebView.
Se durante l'implementazione emerge un target che non lo regge, il fallback e dichiarare
anche le triplette RGB (`--color-accent-rgb: 227 161 95`) e usare `rgb(... / .28)`: stessa
struttura, sintassi piu vecchia.

### 4.2 Tipografia

```
fontUi, fontProse       id da un elenco curato (vedi §7), non stringhe libere
sizes                   display, chapter, pageHeader, headline, title, prose,
                        body, meta, label, metric        (10 ruoli)
weights                 headline, prose, label, metric
tracking                headline (negativo), label (positivo)
lineHeight              display, editorial, prose, body
```

I nomi sono **ruoli**, non misure: un tema non decide "18px", decide "quanto e grande il
ruolo prosa". Se un componente ha bisogno di una taglia che non e un ruolo, il ruolo manca:
si aggiunge al contratto, non si scrive un numero.

### 4.3 Forma, spazio, profondita, moto

```
radius        sm, md, lg, xl, pill, circle
borderWidth   hairline, strong
space         un moltiplicatore (vedi sotto)
elevation     1, 2, 3
glow          l'alone dell'accent (puo essere "none": vedi il tema Macchina)
grain         opacita della grana, 0 = via
warmth        i radial-gradient di calore, "none" ammesso
press         scala del feedback al tocco, 1 = niente
```

**Sulla spaziatura, la proposta e volutamente conservativa.** Un tema non ridefinisce ogni
valore della scala: dichiara **un moltiplicatore** (`space: 0.82` = denso, `1` = normale,
`1.15` = arioso), e ogni valore della scala 8pt si moltiplica per quello.

Motivo: una scala di spaziatura completamente libera significa che ogni schermata deve
reggere qualunque combinazione, e le rotture di layout non si scoprono per ragionamento —
si scoprono in produzione, una alla volta. Con un moltiplicatore l'insieme dei casi da
verificare e tre, non infinito, e visivamente si ottiene comunque quasi tutta la differenza
(nel mockup: Macchina sta a 0,88, Malva a 1,06, Carta a 1,08). Se un giorno servira di
piu, allargare il contratto dopo e facile; restringerlo dopo, no.

**`--space` moltiplica padding, gap e margin. Non moltiplica le larghezze dei contenitori.**
Questa non e una preferenza: e uscita dal mockup renderizzato. Nella prima versione la rail
sinistra era `calc(206px * var(--space) + 16px)`, e col tema Macchina — mono, quindi
caratteri piu larghi — la voce "Racconta a voce" andava a capo su due righe. Rail e colonne
sono metriche di **layout**, non di ritmo: restano fisse (222px e 288px), e se un giorno
dovranno cambiare per tema diventeranno token loro, dichiarati apposta.

---

## 5. Come e fatto un tema, e dove vive

```
src/themes/
  contract.ts     il tipo Theme + DEFAULT_THEME + resolveTheme(partial)
  fonts.ts        l'elenco curato delle famiglie (vedi §7)
  minimal.ts      Inter + Newsreader. Nero, grigio, bianco. Molto Apple
  wine.ts         Inter + Spectral. Il brandbook
  carta.ts        Inter + EB Garamond. Libro (space 1.08)
  malva.ts        DM Sans + Cormorant Garamond. Editoriale, greige e prugna (space 1.06)
  macchina.ts     IBM Plex Mono. Mono, senza colore, angoli vivi (space .88)
  index.ts        registry dei temi inclusi
```

Ogni file esporta un tema **con entrambi i set**, `light` e `dark`. Nessuna eccezione fra
quelli inclusi.

**Il tema di default e `minimal`, con appearance `sistema`** (deciso il 17 agosto 2026).
Due motivi: il caso d'uso centrale e scrivere a lungo su un portatile, e Inter + Newsreader
su fondo neutro e la combinazione piu riposante per farlo; e per chi scarica l'app senza
sapere cos'e, un default sobrio e una prima impressione piu sicura di un tema scuro
color vino. `wine` non perde niente — resta incluso, e a un tap di distanza — e il
brandbook resta la sua definizione. Se la decisione cambia, e **una riga**:
`DEFAULT_THEME` in `contract.ts`. Quello che invece cambia davvero sono icona, landing e
screenshot dell'App Store, che vanno rifatti sul tema di default, non su `wine`.

I temi inclusi sono **`.ts` tipizzati**, cosi `tsc` accorge se ne manca uno. I temi importati
o scaricati sono **JSON validato** contro lo stesso tipo: `resolveTheme(partial)` fonde il
parziale sul default e scarta le chiavi ignote.

**Un tema e dati, mai codice.** Nessun CSS arbitrario, nessuna `url()`, nessuna stringa che
finisca dentro un `style` senza passare da un validatore. Un tema che potesse contenere CSS
potrebbe fare una richiesta di rete a un dominio qualsiasi al solo caricarsi — che, in
un'app che promette "niente esce da qui", sarebbe la fine della promessa. Il validatore
accetta: colori in formato noto, id di font dall'elenco, numeri entro range, enum. Nient'altro.

### Applicazione, senza flash

Il tema si applica scrivendo `data-theme` e `data-mode` su `<html>` piu le custom property.
Deve succedere **prima del primo paint**, in uno script inline bloccante nel `<head>`, che
legge tema e appearance da `localStorage` e risolve `system` con
`matchMedia("(prefers-color-scheme: dark)")`. Se aspetti React, ogni avvio dell'app
lampeggia — e in un'app che si apre al buio a colazione, lampeggiare bianco e la cosa
peggiore che puoi fare. Esiste gia un precedente nel repo per lo script inline nel layout
(la splash, `src/components/splash.tsx` e il failsafe inline).

Tre cose che vanno con l'appearance e che di solito ci si dimentica:

- `color-scheme: light` / `dark` su `<html>`, altrimenti scrollbar, campi di testo e
  controlli nativi restano dell'altro verso.
- Il `<meta name="theme-color">` va aggiornato con `bgApp` del set attivo (barra di stato
  in PWA e in WKWebView).
- Con appearance `system`, il listener su `matchMedia` deve restare attivo per tutta la
  sessione: il Mac cambia da solo al tramonto, e l'app deve seguirlo senza un reload.

Dove si salva la scelta (tema **e** appearance): `meta` in IndexedDB per la modalita locale,
`user_settings` per il cloud (la tabella esiste gia, migration `002`), **piu** una copia in
`localStorage`, che e l'unica che lo script di boot puo leggere in modo sincrono.

---

## 6. Validazione del contrasto — non facoltativa

Prima che un tema sia selezionabile (incluso, importato o scaricato), un validatore
controlla le coppie che l'app usa davvero, **su tutti e due i set**. Un tema che passa in
scuro e fallisce in chiaro non passa.

```
ink / bgApp           >= 4.5   testo primario
ink / surface         >= 4.5
inkMuted / surface    >= 4.5   prosa e descrizioni
inkFaint / surface    >= 4.5   caption e label   <- e la coppia che oggi FALLISCE
onAccent / accent     >= 4.5   testo dei bottoni
accent / bgApp        >= 3.0   elementi non testuali
```

Nota che riguarda anche il presente, non solo i temi futuri: nel tema `wine` attuale
`inkFaint #8E7770` su `surface #1D1013` da **4,42:1**, sotto la soglia AA. Nel mockup
`temi.html` l'ho gia corretto a `#9A8279`, che porta il rapporto a 5,55.

I dieci set del mockup sono stati misurati con un calcolo reale del rapporto WCAG, non a
occhio. Valori risultanti (prosa / caption / testo del bottone primario):

```
minimal   chiaro   8,93   5,07   16,83      minimal   scuro   9,97   5,43   15,46
wine      chiaro   8,13   4,97    5,36      wine      scuro  10,43   5,55    8,56
carta     chiaro   8,00   4,54    5,20      carta     scuro   8,60   5,18    6,62
malva     chiaro   7,71   4,92    6,47      malva     scuro   9,28   5,64    8,43
macchina  chiaro  10,41   6,12   18,09      macchina  scuro   8,84   4,99   16,91
```

Il primo giro aveva `wine` chiaro col bottone a **4,14** (accent `#B26A2B` sotto testo
chiaro): fuori norma. Corretto portando l'accent a `#9A5A22`. E esattamente il tipo di
errore che nessuno vede a occhio e che il validatore prende ogni volta — motivo per cui
non e facoltativo.

Un tema che non passa non viene rifiutato in silenzio: dice quale coppia fallisce e di
quanto. Se il tema e dell'utente, resta usabile con un avviso; se viene dal marketplace,
non viene pubblicato.

---

## 7. I font sono il vincolo vero

Il repo usa `next/font/local` con i woff2 committati in `src/fonts/`, e non e un caso:
HANDOVER §12 dice che una build che deve raggiungere Google Fonts e una build che fallisce
senza rete, e il bundle iOS deve funzionare offline. Quindi:

- **Un tema non porta un font da internet.** Sceglie da un **elenco curato** incluso nel
  bundle. L'elenco vive in `src/themes/fonts.ts` e il contratto accetta solo id da li.
- Font aggiuntivi scaricabili sono una funzione **premium** e solo su web: dentro il guscio
  iOS e in modalita locale non si scarica niente.

L'elenco di partenza, quello dei cinque temi inclusi:

| Famiglia | Ruolo | Perche |
|---|---|---|
| **Inter** | UI | gia nel repo. Il piu vicino a SF Pro fra i liberi |
| **Newsreader** | prosa | il parente libero del New York di Apple. Ottico variabile, bellissimo a 19px |
| **Spectral** | prosa | gia nel repo, e il serif del brandbook |
| **EB Garamond** | prosa | il piu classico e "libro" del gruppo, per il tema Carta |
| **DM Sans** | UI | geometrico e caldo, meno neutro di Inter senza diventare vezzoso, per Malva |
| **Cormorant Garamond** | prosa | grazie sottilissime, contrasto alto: l'aria di una rivista. Va usato da 21px in su e a peso 500, sotto sparisce |
| **IBM Plex Mono** | UI + prosa | il mono, per il tema Macchina |

**Costo reale, misurato sui pacchetti `@fontsource`, non stimato:**

```
Inter               47,1 KB      Spectral       4 pesi   87,9 KB
Newsreader          56,7 KB      IBM Plex Mono  2 pesi   28,9 KB
EB Garamond         43,3 KB      ------------------------------
DM Sans             36,1 KB      TOTALE                336,7 KB
Cormorant Garamond  36,8 KB
```

**337 KB** per tutte e sette, latino, in woff2. Molto meno di quanto sembra: sono variabili,
quindi un file copre tutti i pesi. Su un bundle iOS che sta a 2 MB e un costo trascurabile,
e in cambio ogni tema incluso funziona offline — che e la promessa. Attenzione al subset:
serve il latino esteso, altrimenti spariscono le accentate italiane (`à è é ì ò ù`).

Nota pratica: `next/font/local` va dichiarato **staticamente**, non si puo costruire il
nome del file a runtime. Quindi tutte e sei le famiglie si dichiarano in `layout.tsx`
esponendo ciascuna una CSS variable, e il tema si limita a scegliere **quale variable**
mettere in `--font-ui` / `--font-prose`. Non provare a caricare un font in base al tema
attivo: quella strada finisce in un flash di testo non stilizzato a ogni cambio.

---

## 8. Marketplace: cosa e gia deciso da vincoli che esistono

Non serve progettarlo adesso, ma tre cose sono gia determinate e vanno scritte ora per non
scoprirle dopo:

1. **In modalita locale non esiste.** Scaricare un tema e una richiesta di rete, e la
   promessa e zero richieste. I temi inclusi ci sono tutti; quelli della community sono
   una funzione da account cloud. Nel picker si vede la sezione, disattivata, con il motivo
   scritto: non e un gancio commerciale, e la conseguenza onesta della promessa.
2. **Un tema pubblicato e un JSON validato**, dunque moderabile in automatico su contrasto
   e formato. Resta da moderare a mano solo il nome e l'autore.
3. **Puo essere una leva economica** senza toccare l'AI: temi premium, o temi della
   community per abbonati. E l'unica funzione premium che non ha un costo server per uso,
   quindi e la piu sana da regalare per attirare.

---

## 9. Ordine di lavoro della PR 0

| Passo | Cosa | Verifica |
|---|---|---|
| 0.1 | `contract.ts` col tipo `Theme` (condivisi + `light` + `dark`), `DEFAULT_THEME`, `resolveTheme()` | `tsc` |
| 0.2 | `wine.ts`, set `dark` coi valori attuali estratti da `globals.css` | confronto visivo su tutte le schermate: **deve essere identico a prima** |
| 0.3 | Rifattorizzare `globals.css`: 166 colori letterali -> `color-mix` sui 13 token; 592 px -> ruoli e scala per `--space` | nessun cambiamento visivo |
| 0.4 | Ripulire i 23 colori letterali e le 23 classi arbitrarie nei `.tsx` | nessun cambiamento visivo |
| 0.5 | Le sei famiglie in `layout.tsx` via `next/font/local`, ognuna con la sua CSS variable | nessun font da rete, verificato a rete spenta |
| 0.6 | Applicazione: script inline nel `<head>` per `data-theme` + `data-mode`, `color-scheme`, `theme-color`, listener su `matchMedia`, persistenza, hook `useTheme()` / `useAppearance()` | nessun flash all'avvio ne al cambio, verificato in Chrome |
| 0.7 | `wine.light`, poi `minimal`, `carta`, `malva`, `macchina` con entrambi i set | ogni schermata resta leggibile e integra in **dieci** combinazioni |
| 0.8 | Validatore di contrasto su entrambi i set + fix di `inkFaint` in `wine` | passa su tutte e dieci |
| 0.9 | Altro > Aspetto: switch chiaro/scuro/sistema + griglia dei temi con anteprime vive | verifica in Chrome |

**Il passo 0.2 e la rete di sicurezza dell'intera PR.** Se dopo aver estratto `wine.dark` la
UI non e identica a prima, hai perso qualcosa: fermati li e trovalo, non andare avanti.

Il tema `macchina` non e un capriccio: e il caso limite che dimostra che il contratto tiene.
Ha `glow: none`, `grain: 0`, `warmth: none`, tutti i raggi a 0 e `accent` uguale a `ink`.
Se l'app regge quello, regge qualunque tema. `minimal` e il caso limite dall'altra parte:
accent monocromatico, zero texture, e il chiaro e bianco puro.

**Una nota su `malva`, perche non venga "semplificato" in fase di implementazione.**
Nasce dalla richiesta di un tema che piaccia al pubblico femminile. La prima versione era
rosa cipria ed era sbagliata: il rosa saturo e il colore che *dichiara* il destinatario, e
un tema che dichiara il destinatario viene scelto da meno persone di quante lo vorrebbero.
`malva` ci arriva per sottrazione — greige caldo, accento prugna smorzata `#8A4A64`, la
palette di Aesop e Kinfolk — e lascia il lavoro alla tipografia. Se qualcuno in futuro
"aggiusta" l'accent alzandone la saturazione, il tema smette di funzionare.


---

## 10. Cosa non fare

- Nessun valore di marca dentro un componente. Se stai per scrivere un `#`, una `rgba(` o un
  `px` in un `.tsx`, ti manca un token.
- Nessun tema che sia CSS, HTML, o una stringa iniettata in `style` senza validazione.
- Nessuna chiave del contratto aggiunta "al volo" da un componente: si aggiunge al contratto,
  in `contract.ts`, e la si documenta nel capitolo 00 del brandbook.
- Nessun tema selezionabile che non passi il validatore di contrasto.
- Non trasformare la spaziatura in un campo libero (§4.3).
- Non far scaricare font o temi in modalita locale.
- Non derivare il set chiaro invertendo quello scuro. Si dichiarano tutti e due.
- Non trattare la light mode come un tema separato: e un asse indipendente (§4.0).
- Non caricare un font in base al tema attivo a runtime: `next/font/local` e statico (§7).
