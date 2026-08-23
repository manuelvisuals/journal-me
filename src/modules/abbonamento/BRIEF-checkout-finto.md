# Checkout finto per lo sviluppo — richiesta riformulata

Richiesta di Manuel del 21 agosto 2026, riscritta perche sia eseguibile da chi
non ha visto la conversazione. Non e un bug: e una funzione nuova, di soli test.

## 1. Il problema, per come si vede oggi

Su https://journal-me-weld.vercel.app, un utente cloud con piano `free`:

1. scrive una giornata e vede il banner "Con premium questa giornata avrebbe un
   titolo, una sintesi e le macro-aree...";
2. tocca "vedi" e si apre `PremiumWall` (`src/components/premium-wall.tsx`);
3. tocca "prova premium . 4,99 EUR al mese", che chiama
   `POST /api/stripe/checkout`;
4. la route risponde **503** perche `STRIPE_SECRET_KEY` e `STRIPE_PRICE_ID` non
   sono configurate, e il muro mostra "L'abbonamento si attiva a breve".

Risultato: **non c'e nessun modo di provare l'app da premium** senza cambiare a
mano `profiles.plan` sul database. Ogni verifica delle funzioni premium e
bloccata da questo.

## 2. Cosa si deve poter fare

Un percorso di acquisto **finto**, che non tocca Stripe e non incassa niente, ma
che percorre esattamente le stesse schermate di quello vero: muro premium ->
pagina di pagamento -> ritorno nell'app da premium.

### 2.1 Il percorso

1. Nel muro premium, il tasto "prova premium" porta a **`/checkout-finto`**.
2. `/checkout-finto` e una pagina spoglia, dichiaratamente finta (scritto in
   chiaro: "pagamento simulato, nessun addebito"), con due soli tasti:
   - **"Simula pagamento riuscito"**
   - **"Simula pagamento fallito"**
3. **Riuscito** -> chiama una rotta server che porta l'utente **loggato** a
   `plan = 'premium'`, poi rimanda nell'app.
4. **Fallito** -> torna nell'app **senza cambiare il piano**, e l'errore si vede
   scritto (avviso `toast.error`, `src/components/ui/toast.tsx`), non in silenzio.
5. Tornando dal successo compare **un popup di congratulazioni**, curato, sobrio,
   niente coriandoli: un titolo, una riga, un tasto per chiuderlo.

### 2.2 Cosa deve succedere DOPO, senza ricaricare a mano

Questo e il punto che fa la differenza fra "funziona" e "sembra rotto":

- le funzioni premium si sbloccano subito (microfono, sintesi AI, recap,
  pattern): passa tutto da `useCan()` in `src/lib/capabilities.ts`, che legge
  `usePlan()` in `src/lib/plan.ts`;
- `src/lib/plan.ts` tiene una cache in `localStorage["jm.plan"]` e un refresh in
  background che parte **una volta sola** (`refreshStarted`): dopo il pagamento
  finto va **forzato** un nuovo giro, altrimenti la schermata resta free finche
  l'utente non ricarica;
- il banner "Con premium questa giornata avrebbe..." deve sparire;
- accanto al nome utente (Impostazioni) deve comparire che sei **premium**.

## 3. I vincoli, in ordine di importanza

1. **Non deve essere raggiungibile in produzione vera.** Questa cosa regala
   premium a chi la trova. Va accesa da una variabile d'ambiente esplicita
   (per esempio `JM_FAKE_CHECKOUT=1`) e, quando e spenta, la pagina e la rotta
   devono rispondere **404**, non un errore parlante. Nota che
   journal-me-weld.vercel.app **e** la produzione: la variabile va accesa li per
   provare, e spenta prima di aprire l'app a persone vere.
2. **In piu, solo per email autorizzate.** Anche a variabile accesa, la rotta
   concede premium solo se l'email dell'utente e in un elenco
   (`JM_FAKE_CHECKOUT_EMAILS`). Doppia serratura: se un giorno la variabile
   resta accesa per sbaglio, il danno e comunque zero.
3. **Il piano si scrive SOLO lato server**, dopo aver verificato la sessione
   (`requireUser` in `src/lib/server/entitlement.ts`). Mai dal browser: se il
   client potesse scrivere `plan`, chiunque diventerebbe premium con la console.
4. **Si scrive `plan_source = 'dev'`**, non `'stripe'`. Cosi si distingue a
   colpo d'occhio chi e premium finto, e il webhook Stripe vero
   (`src/app/api/stripe/webhook/route.ts`, l'unico posto che scrive
   `plan_source = 'stripe'`) non entra mai in conflitto.
5. **Serve anche la strada inversa**: un modo, nella stessa pagina finta, per
   tornare `free`. Senza, il primo test brucia l'account e non si puo piu
   provare il percorso da capo.
6. `/api/stripe/checkout` **non si tocca**: quando le chiavi Stripe vere
   arriveranno, il percorso vero deve funzionare senza smontare niente.

## 4. Da decidere prima di scrivere il codice

- Il popup di congratulazioni e un cambiamento visivo: **prima il mockup HTML,
  poi l'ok di Manuel**, poi il codice (regola fissa del progetto).
- Dove va la targhetta "premium" accanto al nome utente: Impostazioni ha gia
  l'intestazione con l'email, ed e il posto naturale.
- Le stringhe nuove vanno tradotte anche in inglese (il catalogo i18n).

## 5. Come si verifica che e fatto davvero

Con un account `free` vero, in cloud:

1. il banner porta al muro, il muro porta a `/checkout-finto`;
2. "fallito" lascia il piano a `free` e mostra un errore leggibile;
3. "riuscito" porta nell'app, mostra il popup, e **senza toccare il tasto
   ricarica**: microfono attivo, banner sparito, targhetta premium accanto al
   nome;
4. dopo un ricaricamento vero il premium e ancora li (cioe: e sul database, non
   solo in `localStorage`);
5. con `JM_FAKE_CHECKOUT` spenta, `/checkout-finto` e la sua rotta rispondono
   404;
6. con la variabile accesa ma con un'email non in elenco, la rotta rifiuta e il
   piano resta `free`.
