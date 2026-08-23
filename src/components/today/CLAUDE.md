# Modulo OGGI (parte 1 di 3: la giornata di oggi)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Il modulo Oggi e la schermata principale: racconto a voce/scritto, editor, giornata
raccontata, metriche, obiettivi. E diviso su tre cartelle che vanno considerate UN
perimetro solo: `src/components/today` (questa), `src/components/day` (una giornata
scelta dal calendario) e `src/components/aree` (le icone delle macro-aree). Le pagine
che lo montano: `src/app/page.tsx` e `src/app/giorno/`.

- Prefissi CSS del modulo (misurati il 23 ago): `jm-ed`, `jm-editor`, `jm-fv`,
  `jm-rec`, `jm-day`, `jm-area`, `jm-metric`, `jm-stepper`, `jm-rm`, `jm-goal*`,
  `jm-write`, `jm-add`, `jm-ptt`. L'elenco vero e nei componenti: in dubbio, grep.
  CSS nuovo da branch: in `src/app/features.css`, con questi prefissi.
- Orchestrazione del salvataggio: `src/lib/actions/save-recording.ts` (e scheletro:
  se serve cambiarla, chiedi a Manuel).
- Banchi da far girare prima del push: `verify-pr7`, `verify-testo-giorno`,
  `verify-aree`, `verify-icone-aree`, `verify-titolo-vivo`, `verify-titolo-luoghi`,
  `verify-giornata-larghezze`, `verify-analisi-testo-re`, `verify-chiarimenti`
  (gira con `node --experimental-strip-types`), `verify-chiarimenti-vivo` e
  `verify-togli-pill` (piu tsc, eslint, verify-i18n).
- Le domande che l'AI fa invece di indovinare (23 ago): `chiarimenti-screen.tsx` qui,
  la logica in `src/lib/chiarimenti*.ts`, i soprannomi in `src/lib/aliases.ts`, la
  rotta in `src/app/api/chiarimenti/`. Il disegno approvato:
  `design/mockups/domande-analisi.html`. Due regole da non tradire: le domande di
  IDENTITA valgono per sempre e quelle di EPISODIO solo per quella giornata; e
  SALTARE NON CANCELLA — una domanda saltata torna alla prossima analisi
  (migrazione 014, la coda). L'unica uscita definitiva e "non e una persona".
- Chi passa a premium si porta dietro un archivio mai letto: la scansione di
  tutto il diario e in `src/lib/actions/scan-archivio.ts`, parte da Oggi e
  finisce facendo le domande, come qualsiasi altra analisi.
- Persone e luoghi di una giornata passano TUTTI da `src/lib/use-day-lists.ts`:
  prima i soprannomi, poi le cose tolte con la X. Non leggere `entry.people`
  direttamente in una schermata nuova, o la X non varrebbe li.
- NON toccare: gli altri moduli, `src/styles/base.css`/`overrides.css`, `en.ts`, `src/lib/**` (scheletro).
