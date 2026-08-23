# Modulo IMPOSTAZIONI

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

La forma del modulo (passo D): `components/` le schermate, `styles.css` il
CSS, `en.ts` le traduzioni, `index.ts` la PORTA — l'unica cosa che gli
altri moduli possono importare (il lint dei confini e a ERRORE).

Impostazioni a pannelli (obiettivi, lingua, tema, dimensione testo, dati,
account, moduli utente), la rail destra su desktop e la schermata Consumi AI
con la barra della quota. Pagina: `src/app/settings/`.

- Prefissi CSS (misurati): `jm-st`, `jm-usage`, `jm-cs`, `jm-sw`, `jm-theme`,
  `jm-backup`, `jm-lang`.
- I dati dei consumi arrivano da `src/lib/data/usage.ts` e `/api/usage`
  (scheletro).
- Banchi prima del push: `verify-impostazioni`, `verify-lingua`,
  `verify-parole-misure`, `verify-checkout-obiettivi`, `verify-consumi`
  (piu tsc, eslint, verify-i18n).
