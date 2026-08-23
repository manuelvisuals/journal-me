# Il prompt per aprire una chat worker

Manuel: copia il blocco qui sotto in una chat nuova, riempi le DUE righe segnate con
`<<...>>`, e incolla. Tutto il resto lo impara la chat da sola leggendo il repo.

---

Lavori su Journal.me, repo `manuelvisuals/journal-me` (deploy automatico su Vercel).

IL TUO MODULO: <<nome del modulo: oggi / mese / ricorda / recap / impostazioni /
accesso / palestra — dalla tabella di ARCHITETTURA.md §2>>

IL COMPITO: <<cosa voglio, in una o due frasi. Se e una modifica visiva, prima il
mockup in design/mockups/ e me lo fai approvare, poi il codice>>

Prima di toccare qualsiasi file, in quest'ordine:
1. leggi `ARCHITETTURA.md` (la mappa: scheletro e moduli, e a che punto e il piano);
2. leggi il `CLAUDE.md` della cartella del tuo modulo (il tuo perimetro esatto:
   file, prefissi CSS, banchi di verifica, divieti);
3. leggi `WORKERS.md` (il protocollo di lavoro in parallelo: e vincolante);
4. leggi le sezioni di `HANDOVER.md` che riguardano il tuo compito.

Le regole che rompono tutto se le sbagli:

- **Branch, mai main.** Crea `worker-<modulo>-<compito>` da `origin/main` e pusha
  SOLO quello. Il merge su main lo decide Manuel. Se il push risponde 403 "access
  denied by the git proxy", non e un permesso mancante: ripeti con
  `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY -u ALL_PROXY -u all_proxy git push origin <branch>`.
- **Solo il tuo modulo.** Niente modifiche a `src/lib/**` (eccetto il catalogo del
  tuo modulo in `src/lib/i18n/catalogs/`), `src/themes/**`, `src/components/ui/**`,
  `src/components/desktop/**`, `globals.css`, `en.ts`, ne agli altri moduli. Se il compito sembra richiederlo, fermati e dillo a Manuel: o e un
  compito da sessione scheletro, o c'e una strada dentro il tuo recinto.
- **Il CSS del tuo modulo vive in `src/styles/<modulo>.css`** (il tuo CLAUDE.md dice
  quale): scrivi li, con le classi col prefisso del tuo modulo. `globals.css` e solo
  l'indice degli import; `base.css` e `overrides.css` sono scheletro e non si toccano.
  **Le traduzioni del tuo modulo vivono in
  `src/lib/i18n/catalogs/<modulo>.ts`** (en.ts e solo l'unione, non si tocca). Solo token del tema (`--color-*`, `--jm-*`), mai colori o misure a mano;
  ogni font-size e `calc(Npx * var(--jm-ui-scale))`; ogni testo a schermo passa da
  `t()` di `@/lib/i18n`.
- **git**: email `spamming.madh52@gmail.com`; `git add <file espliciti>`, mai `-A`;
  niente reset/rebase/stash/clean (merge ok); `git push --dry-run` prima del push.
- **Prima di dichiarare finito**: `npx tsc --noEmit && npx eslint .` puliti (i warning
  "Confine fra moduli" nuovi sono un errore tuo: rientra nel recinto), piu
  `node scripts/verify-i18n.mjs`, piu i banchi elencati nel CLAUDE.md del tuo modulo
  (serve il dev server: leggi in HANDOVER.md §10 come si avvia in sandbox). Se il tuo
  lavoro introduce un comportamento che nessun banco copre, scrivi la guardia e
  PROVALA A MORDERE: reintroduci il difetto, guarda il banco diventare rosso,
  ripristina.
- **Fermati a uno stato pulito.** Se il tempo finisce, committa un pezzo che funziona,
  non un refactor a meta. E aggiorna il CLAUDE.md del modulo se hai cambiato qualcosa
  che quel file racconta.

Manuel legge le risposte in italiano. Non e un tecnico: quando gli parli, spiega le
scelte in parole semplici e — quando serve una decisione — UNA domanda per risposta,
con opzioni numerate. Sii onesto sul non-fatto: un "fatto" detto prima di aver
verificato nel browser e una bugia, non una cortesia.

---

## Perche queste regole (per il worker che le trova strette)

Il 23 agosto 2026 tre sessioni hanno lavorato in parallelo senza recinti: tre conflitti
su `globals.css`/`en.ts`/`settings-client.tsx`, due risoluzioni automatiche che hanno
CORROTTO il CSS, la stessa funzione costruita due volte da due chat diverse, e tre giri
di fetch-merge-push per riuscire a pushare. I recinti esistono perche e gia successo.
