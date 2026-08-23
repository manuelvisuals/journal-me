# Modulo ACCESSO (parte 1 di 2)

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Login con codice via email (niente password) e la scelta iniziale delle due modalita.
E un perimetro unico con `src/app/benvenuto/`. Il flusso auth server-side
(`src/app/auth/`, `src/lib/supabase/`) e scheletro.

- Prefissi CSS: `jm-benv` (benvenuto); la pagina login oggi usa utility Tailwind,
  se le servono classi nuove il prefisso e `jm-login`. Il CSS del modulo vive in `src/styles/accesso.css` (passo B, 23 ago).
- Le traduzioni del modulo vivono in `src/lib/i18n/catalogs/accesso.ts` (passo C).
- Banchi prima del push: `verify-pr10` (il locale non fa MAI rete: e la promessa piu
  importante dell'app), piu tsc, eslint, verify-i18n.
- NON toccare: gli altri moduli, `src/styles/base.css`/`overrides.css`, `en.ts`, `src/lib/**` (scheletro — con UNA eccezione: il catalogo del tuo modulo in `src/lib/i18n/catalogs/`).
