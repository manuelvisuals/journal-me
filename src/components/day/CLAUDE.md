# Modulo OGGI (parte 2 di 3: una giornata scelta)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Questa cartella e parte del modulo Oggi insieme a `src/components/today` (leggi il
CLAUDE.md di la: prefissi, banchi e divieti sono gli stessi). Qui vive la schermata
`/giorno?d=YYYY-MM-DD`: la stessa giornata, ma scelta dall'utente — percio il
salvataggio usa `skipSplit` (la data l'ha decisa l'utente, non il racconto).
