# App Store Connect: i passi per l'abbonamento (In-App Purchase)

Scritto il 4 settembre 2026 per Manuel. Sono le cose che SOLO tu puoi fare,
perche vogliono il tuo account Apple Developer (intestato a te come persona
fisica). Il codice (plugin StoreKit, route del server, migration) lo scrive
Claude nel branch `abbonamento-iap`; senza questi passi non si puo provare.

Le decisioni sono quelle prese da Manuel il 4 settembre 2026 sul mockup
`design/mockups/abbonamento-iphone.html`: mensile 4,99 EUR, prova gratis di
14 giorni, annuale pronto ma spento.

Regola: NON cambiare il nome del prodotto dopo averlo creato. Su Apple non
si rinomina, si cancella e si rifa, e il codice lo cerca per nome.

## 1. L'accordo per le app a pagamento (una volta sola, per tutte le tue app)

1. Vai su https://appstoreconnect.apple.com e accedi.
2. In alto a destra tocca il tuo nome > **Business** (oppure, nel menu
   principale, **Agreements, Tax, and Banking**).
3. Nella riga **Paid Apps** premi "View and Agree to Terms" e accetta.
4. Compila le tre sezioni: **Banking** (l'IBAN dove Apple paga),
   **Tax Forms** (il modulo fiscale: qui servono i dati della tua partita
   IVA), **Contact Info**. Apple ci mette da qualche ora a qualche giorno a
   dire "Active".
5. Finche lo stato non e "Active", l'app puo mostrare il prodotto ma NON
   completare acquisti: e normale, non e un difetto del codice.

Se hai gia fatto tutto per Stoqfolio, qui e gia "Active": salta al punto 2.

## 2. Il prodotto: l'abbonamento mensile con la prova gratis

1. App Store Connect > **Apps** > dayalogue.
2. Menu a sinistra > **Subscriptions** (Abbonamenti in app) > **Create**
   (il "+" accanto a "Subscription Groups").
3. **Gruppo**: Reference Name `dayalogue premium`. Un gruppo solo: e la
   condizione perche domani mensile e annuale siano alternativi (chi passa
   dall'uno all'altro non paga due volte).
4. Dentro il gruppo, **Create** un abbonamento:
   - Reference Name: `Premium mensile`
   - **Product ID: `com.manuelvisuals.journalme.premium.mensile`**.
     Copialo esatto: il codice lo cerca cosi.
5. Nella pagina del prodotto:
   - **Subscription Duration**: 1 Month.
   - **Subscription Prices** > "+" > scegli Italia come paese di partenza,
     prezzo **4,99 EUR**, poi lascia che Apple calcoli gli altri paesi.
   - **App Store Localization** > "+" > Italian: Display Name `Premium`,
     Description `AI senza limiti: racconto a voce, titolo, sintesi, aree,
     recap. Backup ogni notte.` Aggiungi anche English (Premium / Unlimited
     AI: voice, title, summary, areas, recaps. Nightly backup.).
   - **Review Information**: uno screenshot del muro premium (lo faccio io
     dal simulatore e te lo mando) e due righe di note per il revisore.
6. **La prova gratis** (decisione di Manuel: 14 giorni, uguale per tutti):
   nella stessa pagina, sezione **Subscription Prices** > **Introductory
   Offers** > "+" > tutti i paesi > tipo **Free** > durata **2 Weeks** >
   senza data di fine. Salva.
7. Torna al gruppo e apri **Localization** del gruppo: Italian, nome
   `dayalogue premium`. Apple lo mostra nella pagina "Abbonamenti" del
   telefono.
8. Lo stato del prodotto restera "Missing Metadata" o "Ready to Submit"
   finche non si invia l'app: per la sandbox va bene cosi.

## 2-bis. L'annuale (quando lo vorrai, non oggi)

Nello STESSO gruppo, **Create** un secondo abbonamento: Reference Name
`Premium annuale`, **Product ID `com.manuelvisuals.journalme.premium.annuale`**,
durata 1 Year, prezzo a tua scelta, stessa offerta introduttiva di 2
settimane. Poi in `/admin > Regalo AI` accendi l'interruttore "Annuale in
vendita": la seconda scheda compare nell'app senza deploy. Il mensile non
si tocca.

## 3. Un utente di prova (sandbox)

1. App Store Connect > **Users and Access** > scheda **Sandbox** >
   **Test Accounts** > "+".
2. Email: una che NON e mai stata un Apple ID (per esempio
   `sandbox.dayalogue@manuelponcia.com` o un alias). Password a tua scelta.
   Paese: Italia. Segnala la password: la scriverai sul telefono.
3. Sul tuo iPhone: **Impostazioni > App Store**, in fondo, **Account
   sandbox** > accedi con quell'utente. NON uscire dal tuo Apple ID vero: la
   sandbox e una casella a parte.
4. Nella stessa schermata, dopo il primo acquisto, compare **Gestisci** con
   il "Subscription Renewal Rate": lascia il default. In sandbox due
   settimane di prova durano 3 minuti e un mese 5: si vede tutto il giro
   (prova, rinnovo, disdetta) in un quarto d'ora.

## 4. La chiave per le notifiche del server di Apple

Serve al server per sapere di rinnovi, disdette e rimborsi anche con l'app
chiusa (come il webhook di Stripe).

1. App Store Connect > **Users and Access** > scheda **Integrations** >
   **In-App Purchase** > "+" (Generate In-App Purchase Key).
2. Nome: `dayalogue server`. Scarica il file `.p8`: si scarica UNA volta
   sola, tienilo. Annota **Key ID** e, in alto, **Issuer ID**.
3. Mandami (in chat, non nel repo) tre cose: il contenuto del file `.p8`,
   il Key ID, l'Issuer ID. Le metto su Vercel come `APPLE_IAP_KEY_ID`,
   `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`. Non finiscono mai nel
   codice.
4. Apps > dayalogue > **App Information** > sezione **App Store Server
   Notifications**: Production Server URL e Sandbox Server URL, entrambi
   `https://journal-me-weld.vercel.app/api/apple/notifiche`, versione
   **Version 2**. (L'indirizzo lo confermo io quando la route e deployata.)
5. Nella stessa pagina App Information annota l'**Apple ID** dell'app (un
   numero) e, sotto General, il **Bundle ID**
   `com.manuelvisuals.journalme`: il server li controlla su ogni ricevuta.

## 5. Su Xcode (quando il branch e pronto, te lo dico io)

1. `bash "$HOME/Developer/journal-me/aggiorna-e-apri-xcode.command"` come
   sempre.
2. In Xcode: App > Signing & Capabilities > "+ Capability" >
   **In-App Purchase**. Una volta sola.
3. Per provare SENZA App Store Connect (prima che i passi 1-3 siano
   pronti) c'e un file di configurazione StoreKit locale nel repo
   (`ios/App/Dayalogue.storekit`): Product > Scheme > Edit Scheme > Run >
   Options > StoreKit Configuration > sceglilo. Con quello l'acquisto e
   finto ma il giro dell'app e vero.

## Cosa NON fare

- Non premere "Submit for Review" sul prodotto da solo: si invia insieme
  alla prima versione dell'app.
- Non creare il prodotto con un nome diverso da quello concordato "tanto
  poi si cambia": non si cambia.
- Non mettere il file `.p8` nel repo, in una nota, o in uno screenshot.
