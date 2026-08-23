# Modulo MESE

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La vista mensile: griglia dei giorni, rail delle statistiche, navigazione fra mesi,
teaser dei pattern (premium). Pagina: `src/app/mese/`.

- Prefissi CSS (misurati il 23 ago): `jm-mese`, `jm-month`, `jm-dots`, `jm-picker`.
  il CSS del modulo vive in `src/styles/mese.css` (passo B, 23 ago).
- Le traduzioni del modulo vivono in `src/lib/i18n/catalogs/mese.ts` (passo C).
- Banchi prima del push: `verify-pr9`, `verify-mese-nav` (piu tsc, eslint, verify-i18n).
- NON toccare: gli altri moduli, `src/styles/base.css`/`overrides.css`, `en.ts`, `src/lib/**` (scheletro — con UNA eccezione: il catalogo del tuo modulo in `src/lib/i18n/catalogs/`).
