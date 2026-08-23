# Modulo IMPOSTAZIONI (parte 2 di 2: Consumi AI)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Questa cartella e parte del modulo Impostazioni insieme a `src/components/settings`
(leggi il CLAUDE.md di la). Qui vive la schermata Consumi AI: totale del mese, barra
della quota inclusa (plan_limits), attivita. Prefisso CSS: `jm-cs`. Il suo banco:
`verify-consumi` (porta 3200). I dati arrivano da `src/lib/data/usage.ts` e
`/api/usage` (scheletro).
