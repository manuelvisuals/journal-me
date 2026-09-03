# Modulo ADMIN

Le regole comuni a tutti i moduli sono in AGENTS.md (radice) e la mappa in
ARCHITETTURA.md: questo file dice solo cosa e QUESTO modulo.

Il pannello delle impostazioni globali dell'app: `dayalogue.com/admin`.
Entra UN account solo (`madh52@gmail.com`), e il controllo vero sta sul
server (`server.ts`, `requireAdmin`): a chiunque altro la rotta risponde
404 e la pagina non disegna niente. Prima schermata: le Aree (tabella
`aree`, migration 015). Mockup approvato: `design/mockups/admin.html`
(ramo `worker-admin-mockup`).

LA REGOLA PIU IMPORTANTE: questo modulo SCRIVE le aree ma non le presta a
nessuno. Chi le legge (`oggi`, `recap`, le schermate) passa dal contratto
dello scheletro: `src/lib/aree.ts` (tipo e rete di sicurezza),
`src/lib/server/aree.ts` (`leggiAree`, lato server),
`src/lib/aree-client.ts` (`useAree`, lato client). Se il pannello sparisse
domani, il diario non se ne accorgerebbe: e la direzione giusta della
dipendenza.

Cosa il pannello NON fa, per contratto (le decisioni sono di Manuel):
- non cambia mai la `chiave` di un'area esistente: e l'identita scritta
  dentro le giornate salvate. Si rinomina il `nome`, mai la chiave;
- non cancella: un'area si spegne (`attiva=false`). La rotta non ha DELETE;
- le scritture passano SOLO dal service role (la tabella non ha policy di
  scrittura): mai dal client Supabase.

- Pagine di `src/app/` di questo modulo: `(app)/admin/` (guscio),
  `api/admin/aree/` (guscio della rotta).
- Prefisso CSS: `jm-adm`.
- Banchi prima del push: `verify-aree` e `verify-i18n` (piu tsc, eslint).

## Regalo AI (notte del 3 settembre 2026, branch `ospite-server`): solo la rotta

SPEC R4. `server/regalo.ts` -> GET/PUT /api/admin/regalo (guscio in
`src/app/api/admin/regalo/route.ts`): l'interruttore, le giornate per
ospite, il tetto mensile in euro, il cambio USD->EUR, e lo speso del mese
(funzione SQL `riassunto_regalo_mese`, leggibile solo col service role).
Dopo ogni PUT chiama `dimenticaRegalo()` (src/lib/server/regalo.ts) cosi la
guardia rilegge subito. La tabella `regalo` (migration 023) e a una riga,
pubblica in lettura, senza policy di scrittura. La SCHERMATA "Regalo AI"
(mockup `design/mockups/ospite-primo-avvio.html`, 05) prende il posto del
segnaposto "Piani e limiti" ed e da fare dopo l'ok di Manuel. Il contratto
dei limiti e nello scheletro (`src/lib/regalo.ts`), come per le aree.
