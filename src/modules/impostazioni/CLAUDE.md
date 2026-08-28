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
  `jm-backup`, `jm-lang`, `jm-foto`.
- I dati dei consumi arrivano da `src/lib/data/usage.ts` e `/api/usage`
  (scheletro).
- Banchi prima del push: `verify-impostazioni`, `verify-lingua`,
  `verify-parole-misure`, `verify-checkout-obiettivi`, `verify-consumi`,
  `verify-foto-profilo` (piu tsc, eslint, verify-i18n).
- Le API del modulo (passo E): `src/modules/impostazioni/server/usage.ts`,
  `delete-account.ts`, `avatar.ts`; le rotte in `src/app/api/` sono gusci.

## La foto profilo (28 agosto 2026)

Mockup approvato: `design/mockups/foto-profilo-flusso.html`. Nato da una
segnalazione di Manuel: il pallino dell'account era 32px mentre i due
bottoni accanto sono 44 — e non c'era nessun modo di metterci una faccia.

**Chi la mostra non e chi la cambia.** Il pallino vive nello SCHELETRO
(`src/components/ui/account-menu.tsx`, intestazione del telefono e rail del
computer). Il modo di cambiarla vive qui. Il ponte e la porta:
`index.ts` esporta `useFotoProfilo` e lo scheletro importa
`@/modules/impostazioni`, come gia fa con il muro premium di abbonamento.
**`salvaFotoProfilo` NON esce dalla porta**: leggere la foto lo puo fare
chiunque, cambiarla solo questo modulo.

I pezzi:

- `foto-profilo.ts` — lo store: una lettura sola anche con tre pallini
  montati, e il ritorno indietro se il salvataggio fallisce.
- `avatar-contract.ts` — **senza nessun import, di proposito**: l'aritmetica
  del ritaglio e la convalida del formato. Sono le due cose che sbagliano in
  silenzio (una foto tagliata storta sembra una scelta di disegno), e senza
  import un banco le puo ESEGUIRE in Node invece di leggerne il testo.
- `components/foto-row.tsx` — la riga, il foglio delle tre scelte
  (`variant="riga"`, telefono) o il ritratto cliccabile della rail
  (`variant="avatar"`, computer), e il ritaglio a schermo pieno.
- `server/avatar.ts` + `src/app/api/account/avatar/` — la scrittura.

**Perche la scrittura passa dal server e non da una policy.** `profiles`
contiene anche `plan`, e le policy di Postgres valgono per RIGA, non per
colonna: dare all'utente l'update sulla propria riga significherebbe dargli
il permesso di scriversi `plan = 'premium'`. Il service role scrive solo
`avatar_data` e solo per chi ha presentato il token. **Non aggiungere una
policy di update su `profiles`.**

**La foto sta nella riga, non in un bucket.** 256px in JPEG sono ~14 KB in
base64: un deposito file per quella taglia sarebbe piu superficie di quanta
ne risparmi, e cosi la foto sparisce da sola con l'account (cascade della
006), senza che `delete-account.ts` debba sapere che esistono immagini.

**Serve la migration 016** (`supabase/migrations/016_profile_avatar.sql`):
finche Manuel non la incolla nel SQL Editor di Supabase, la lettura risponde
"nessuna foto" e il salvataggio da errore. Non e un guasto silenzioso —
`foto-profilo.ts` tratta la colonna mancante come "nessuna foto", non come
schermata rotta.

**Cosa il banco NON copre.** `verify-foto-profilo.mjs` non apre un browser:
prova aritmetica, convalida, misure e innesti. Il foglio che sale, il
trascinamento e il pallino che cambia vanno guardati con gli occhi, sul
deploy o con gli altri banchi Playwright.
