# Rifare la home di dayalogue.com

Questo file e il mandato per una sessione che lavora SOLO sulla home del sito
pubblico. Chi lo apre legge prima `AGENTS.md` (le regole di ogni sessione) e
`ARCHITETTURA.md` (la mappa di cosa e scheletro e cosa e modulo), poi il
`CLAUDE.md` del modulo sito, poi questo.

## Le coordinate

- Repo: **github.com/manuelvisuals/journal-me**
- Ramo su cui si arriva: **main** (deploy automatico su Vercel a ogni push)
- Il proprio lavoro va su un ramo suo, e su main si arriva per pull request:
  e Manuel a fare il merge. Vedi `WORKERS.md`.
- Sito in produzione: **dayalogue.com** (italiano) e **dayalogue.com/en**

## Dove vive la home, per intero

    src/modules/sito/components/home.tsx    la pagina (componente SERVER)
    src/modules/sito/components/guscio.tsx  barra in alto e piede
    src/modules/sito/styles.css             tutto il CSS, prefisso jm-sito-
    src/modules/sito/testi.ts               OGNI parola, italiano e inglese
    src/modules/sito/metadata.ts, seo.ts    titoli, descrizioni, hreflang
    public/sito/                            le fotografie (.webp)
    src/app/page.web.tsx                    la rotta /   (italiano)
    src/app/en/page.web.tsx                 la rotta /en (inglese)

Fuori da questo elenco NON si tocca niente senza chiedere: `src/themes`,
`src/lib`, `src/components`, `src/styles` sono SCHELETRO condiviso con l'app.

## Le quattro regole del modulo, che non sono opinioni

1. **Server, non client.** Le pagine sono componenti server: cio che scarica
   un motore di ricerca deve essere gia la pagina finita. Se una schermata
   diventa `"use client"`, il banco `verify-sito` lo becca.
2. **Le parole NON passano da `t()`.** E l'unica deroga in tutto il progetto,
   ed e motivata: `t()` risponde italiano finche React non si e idratato, e su
   `/en` Google leggerebbe italiano. Le due lingue stanno una accanto
   all'altra in `testi.ts`: si cambiano SEMPRE in coppia.
3. **Solo token, mai valori a mano.** Colori, raggi e spazi vengono dal
   contratto dei temi (`--jm-*`): il sito eredita il tema che il visitatore ha
   scelto nell'app, quindi un `#fff` scritto a mano si rompe in cinque temi su
   cinque. Ogni `font-size` e `calc(Npx * var(--jm-ui-scale))`.
4. **Niente promesse false.** Nessun prezzo finche il pagamento e spento,
   nessuna recensione, nessun numero di utenti, nessuna promessa sull'App
   Store finche l'app non c'e. Regola di Manuel, non di stile.

## Prima di ogni push

    npx tsc --noEmit
    npx eslint .
    node scripts/verify-i18n.mjs
    node scripts/verify-sito.mjs      (serve il dev server acceso)

## Le versioni congelate: guardarle prima di rifare

Tre home precedenti restano raggiungibili, fuori da Google, coi link in fondo
alla pagina. Servono a non riscoprire cose gia scartate:

- **/v1** la prima home (31 agosto 2026), impostata sulla SEO
- **/v2** (5 settembre) eroe chiaro col telefono fotografato
- **/v3** (7 settembre) l'attuale: fotografia a tutto schermo, barra in vetro

I file sono `home-v1.tsx`, `home-v2.tsx`, `home-v3.tsx`: sono fotografie, non
rami. Non si modificano.

## Cosa e gia stato provato e scartato, con il motivo

- **Telefono a sinistra e testo a destra, con la foto specchiata.** Bocciato:
  girata, la scena perde il senso.
- **Eroe a tre colonne** (telefono | testo | lei, ognuno sul suo fondo).
  Bocciato: il telefono su carta vuota sembrava incollato fuori dalla scena.
- **Meta pagina color crema e meta fotografia.** Bocciato: si vuole la
  fotografia intera.
- **Il telefono come elemento della pagina, sopra una foto di sfondo.**
  Difetto tecnico, non di gusto: la foto e `cover` (il ritaglio si muove con
  la finestra) e il telefono si muoveva con la colonna. Due sistemi di
  coordinate: su certi schermi il telefono finiva sulla faccia della ragazza.
  Oggi foto e telefono stanno nello stesso riquadro e il telefono e
  posizionato in percentuale dentro quel riquadro. Se si rifa l'eroe, questo
  vincolo va rispettato in qualunque forma.

## Il gusto, in una riga

Meno scatole, meno righe di separazione, meno etichette colorate; piu spazio,
piu contrasto fra titolo e testo, una sola cosa arancione per schermata (il
tasto). Le frasi corte: gli elenchi infilati in un respiro solo sono la firma
di un testo scritto da una macchina.

## Credenziali

Non si incollano token o chiavi dentro i file del repo. L'accesso in scrittura
lo da Manuel dal suo GitHub; in mancanza, si consegna un ramo e la pull
request la apre lui.
