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

- Pagine di `src/app/` di questo modulo: `admin/` (guscio),
  `api/admin/aree/` (guscio della rotta).
- Prefisso CSS: `jm-adm`.
- Banchi prima del push: `verify-aree` e `verify-i18n` (piu tsc, eslint).
