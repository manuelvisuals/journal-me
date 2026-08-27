# dayalogue — verso la prima revisione Apple

Scritto il 23 agosto 2026. Deciso da Manuel: da ora **niente funzioni nuove, solo
bugfix**, e si prepara la sottomissione ad App Store Connect il prima possibile
(lancio insieme a Stoqfolio). Questo file e la lista di marcia: si spunta qui.

Il guscio c'e gia (Capacitor 8, `npm run build:ios`, progetto in `ios/App`,
`NSMicrophoneUsageDescription` presente). Quello che manca non e infrastruttura:
sono TRE blocchi da revisione, piu il lavoro di App Store Connect.

## 1. I tre blocchi da risolvere PRIMA di sottomettere — FATTI il 23 agosto

Decisione di Manuel: **v1 senza acquisto su iOS**. Implementati tutti e tre nello
stesso giorno, con il banco `scripts/verify-appstore.mjs` (11 controlli, guscio iOS
simulato via CapacitorCustomPlatform, morso provato: rimettendo la vendita su iOS
il banco esce rosso sui 3 controlli giusti).

- 1a: dentro il guscio (`isNative()`) il muro premium non mostra prezzo ne bottone
  d'acquisto; resta la nota onesta e, per chi un account ce l'ha, "Ho gia un
  account" -> login. Sul web la vendita non cambia.
- 1b: riga "Elimina l'account" nella zona pericolosa (solo cloud), due tocchi,
  route `/api/account/delete` autenticata: cancella l'utente Supabase e la cascata
  `on delete cascade` (verificata su tutte le migration) porta via ogni riga.
- 1c: `/api/review-login` con doppia variabile `JM_REVIEW_EMAILS` +
  `JM_REVIEW_CODE`. CONFIGURATO su Vercel il 23 agosto (Production e Preview,
  Sensitive) e VERIFICATO in produzione dal Chrome di Manuel: login completo con
  appreview@dayalogue.com + codice fisso, account creato, reso premium via SQL
  (profiles.plan='premium', plan_source='manual'), e una giornata demo scritta e
  elaborata dall'AI (titolo, sintesi, aree, persone, luoghi, chiarimenti inclusi).
  Il revisore trova un'app viva. Per le Review Notes: email appreview@dayalogue.com,
  codice 424242. Se il nome dell'app cambia, cambiare l'email e un minuto
  (variabile su Vercel + eventualmente l'account demo).

### 1a. L'acquisto premium dentro l'app iOS (guideline 3.1.1) — IL blocco

Oggi il muro premium chiama il checkout Stripe (`tryPremium` in
`modules/abbonamento/components/premium-wall.tsx`), senza distinzione di
piattaforma. Un abbonamento digitale venduto dentro l'app iOS con un checkout web
e un rifiuto quasi certo.

Due strade (decisione di Manuel, vedi domanda in chat):

- **v1 senza acquisto su iOS** (veloce): dentro il guscio (`isNative()`) il muro
  non mostra il bottone d'acquisto; resta la frase gia in catalogo
  "L'abbonamento si attiva a breve: l'acquisto dentro l'app sta arrivando."
  Niente link o inviti a comprare fuori (anche quello e vietato). Chi e gia
  premium (via web) entra e usa tutto. L'IAP arriva in un aggiornamento.
- **IAP subito** (lento): StoreKit via plugin Capacitor + validazione ricevute
  lato server + gestione del piano doppio binario (Stripe web / IAP iOS).
  Settimane, non giorni.

### 1b. La cancellazione dell'account (guideline 5.1.1(v)) — obbligatoria

L'app permette di creare un account (email + codice), quindi Apple PRETENDE la
cancellazione dell'account DENTRO l'app. Oggi c'e solo "Esci dall'account" e la
cancellazione dei dati locali. Serve:

- una riga "Elimina l'account" in Impostazioni (solo cloud), con conferma a due
  tocchi come la zona pericolosa;
- una route server che, autenticata, cancella l'utente Supabase e tutte le sue
  righe (entries, facts, remembers, goals, recaps, ai_usage, profiles);
- il banco che lo prova.

### 1c. L'accesso del revisore — l'OTP via email lo blocca

Il login e SOLO codice via email: il revisore Apple non riceve le nostre email,
quindi non entra, quindi rifiuta per "unable to review". Serve un account demo:
un'email di prova (es. `review@...`) che con un codice FISSO noto entra su un
account precaricato con qualche giornata. Stessa filosofia del checkout finto
(`JM_FAKE_CHECKOUT_EMAILS`): variabile d'ambiente server con le email ammesse,
mai attiva per il pubblico. Le credenziali si scrivono nelle Review Notes.

## 1-bis. Aggiornamenti del 27 agosto (rename + premium v1)

- **L'app si chiama dayalogue** (era journal.me). Cambiato OVUNQUE il 27
  agosto: marchio a schermo (accento su "day"), Info.plist, manifest,
  bundle id `com.manuelvisuals.dayalogue` (deciso da Manuel: prima della
  prima submission e l'unico momento in cui cambiarlo e gratis). I nomi
  TECNICI restano: database locale `journalme`, chiavi localStorage,
  formato backup `journal.me/backup`, dominio journal-me-weld.vercel.app
  — cambiarli butterebbe i dati degli utenti, non il marchio.
- **Premium v1 su iOS: gratis.** La card Premium di /benvenuto dentro il
  guscio ha di nuovo il tasto, dice solo "inizia cosi" (niente prezzo,
  App Store 3.1.1) e attiva il premium DAVVERO per chiunque
  (`plan_source='ios-v1'`, rotta /api/premium-v1). La decisione e il
  percorso di upgrade all'acquisto vero: PREMIUM_IOS_V1_GRATIS in
  src/lib/pricing.ts.
- **Email revisore: appreview@dayalogue.com** (da riconfigurare su Vercel
  e da ripreparare l'account demo — il vecchio appreview era @journal.me).

## 2. Il resto della lista (necessario, ma senza decisioni)

- **Rebuild del bundle**: l'app sul telefono gira su codice vecchio (pre-temi).
  `npm run build:ios`, poi Xcode (Archive) lo fa Manuel dal Mac. Versione e
  build number da alzare in Xcode.
- **Bug aperti**: passata su HANDOVER §8 e sul referto registrazione
  (`modules/oggi/HANDOVER-recording-bug.md`): il retry di getUserMedia va
  verificato SU DEVICE prima di sottomettere — e il cuore dell'app.
- **Privacy — FATTA il 23 agosto**: pagina statica bilingue su /privacy (l'URL per
  App Store Connect e https://journal-me-weld.vercel.app/privacy, o il dominio che
  Manuel scegliera). Diceva e dice: serviva una pagina privacy policy pubblica che
  dica: email per l'accesso, testo del diario cifrato nel cloud, il testo passa
  a OpenAI per titolo/sintesi/trascrizione, niente pubblicita, cancellazione
  possibile. Le etichette App Privacy in App Store Connect devono dire lo
  stesso (dati collegati all'identita: email, contenuti utente).
- **App Store Connect**: nome, sottotitolo, descrizione, parole chiave,
  categoria (Lifestyle o Salute e benessere), rating eta, screenshot 6.7" e
  6.1" (si fanno dal simulatore o da device), icona gia nel progetto.
- **Review Notes**: account demo (1c), spiegare la modalita locale (nessuna
  rete) e che il microfono serve per raccontare la giornata.

## 3. Ordine proposto

1. Decisione 1a (Manuel) → implementazione del muro su iOS;
2. 1b cancellazione account (route + UI + banco);
3. 1c accesso revisore;
4. verifica bug registrazione su device (Manuel col telefono, guidato);
5. privacy policy (pagina statica nel sito) + etichette;
6. `npm run build:ios`, Manuel alza versione e archivia, sottomissione.

Ogni punto: un branch, verifiche, merge — come da WORKERS.md. I punti 1-3 sono
lavoro dei moduli abbonamento/impostazioni/accesso: possono andare in parallelo
con tre worker, i recinti esistono apposta.
