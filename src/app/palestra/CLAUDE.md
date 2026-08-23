# Modulo PALESTRA (modulo utente, in costruzione)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Il primo "modulo utente" accendibile da Impostazioni > Moduli (mockup
design/mockups/palestra.html). L'interruttore e l'ordine vivono in
`src/lib/modules.ts` (scheletro: si tocca in accordo con Manuel).

- Prefisso CSS: `jm-gym` (oggi `jm-mod-*` per lo stato "presto"). Il CSS del modulo vive in `src/styles/palestra.css` (passo B, 23 ago).
- Le traduzioni del modulo vivono in `src/lib/i18n/catalogs/palestra.ts` (passo C).
- Banchi prima del push: `verify-persona-moduli` (piu tsc, eslint, verify-i18n).
- NON toccare: gli altri moduli, `src/styles/base.css`/`overrides.css`, `en.ts`, `src/lib/**` (scheletro — con UNA eccezione: il catalogo del tuo modulo in `src/lib/i18n/catalogs/`).
