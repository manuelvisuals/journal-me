# Modulo SITO

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Il sito pubblico su **dayalogue.com**: la home che spiega il prodotto e
`dayalogue.com/support`. E l'unico modulo che NON e una schermata dell'app:
vive fuori dal guscio (niente splash, niente cancello, niente rail) e la
sua unica ragione d'essere e farsi trovare e far entrare.

Nato il 31 agosto 2026, mockup approvato: `design/mockups/sito-seo.html`.

- Pagine di `src/app/` di questo modulo: `page.web.tsx`, `en/page.web.tsx`,
  `support/page.web.tsx`, `en/support/page.web.tsx`, piu `robots.ts`,
  `sitemap.ts` e i gusci `api/sito/seo/` e `api/sito/supporto/`.
- Prefisso CSS: `jm-sito`.
- Banchi prima del push: `verify-sito` (piu tsc, eslint, verify-i18n).

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
