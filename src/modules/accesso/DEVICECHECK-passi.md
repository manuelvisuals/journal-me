# DeviceCheck: i passi che toccano a Manuel

Decisione 2A del 10 settembre 2026 (audit del modello premium). Il codice e
pronto e in produzione, ma DeviceCheck e SPENTO finche queste tre variabili
non stanno su Vercel. Finche e spento, il server crea i braccialetti come
prima (cioe il buco del curl resta aperto): e un interruttore, non un deploy.

## 1. La chiave, su developer.apple.com

1. Account > Certificates, Identifiers & Profiles > **Keys** > il piu (+).
2. Nome: `Dayalogue DeviceCheck`. Spunta SOLO **DeviceCheck**. Continue, Register.
3. **Download** della `.p8`: si scarica UNA volta sola. Tienila nel gestore
   password, non nella cartella del progetto.
4. Segnati il **Key ID** (dieci caratteri, in alto nella pagina della chiave).
5. Il **Team ID** e in alto a destra in Membership details (dieci caratteri).

NON e la chiave In-App Purchase di App Store Connect (quella che il server
usa gia per gli acquisti, `APPLE_IAP_*`): sono due chiavi diverse, con due
servizi diversi. Una chiave puo avere tutti e due i servizi, ma tenerle
separate rende ogni revoca un fatto piccolo.

## 2. Le variabili, su Vercel

Progetto dayalogue > Settings > Environment Variables, per Production e
Preview:

| Nome | Valore |
| --- | --- |
| `APPLE_DEVICECHECK_KEY_ID` | il Key ID del punto 4 |
| `APPLE_TEAM_ID` | il Team ID del punto 5 |
| `APPLE_DEVICECHECK_PRIVATE_KEY` | il contenuto della `.p8`, dal `-----BEGIN` al `-----END`, con gli a capo come `\n` (come gia per `APPLE_IAP_PRIVATE_KEY`) |

Poi un redeploy (Deployments > l'ultimo > Redeploy): le route leggono le
variabili all'avvio.

## 3. Cosa succede da quel momento

- Nel guscio iOS l'app chiede a iOS il token (`DeviceCheck.swift`) e lo
  manda a POST /api/ospite/braccialetto al primo avvio: se Apple dice che il
  dispositivo il regalo l'ha gia avuto, niente seconda volta (anche dopo
  cancellazione e reinstallazione senza portachiavi).
- Sul web nessun regalo: la riga "AI in regalo" di Impostazioni dice
  "nell'app per iPhone" e il muro del regalo dice che l'AI si accende
  dall'app. Chi ha l'account premium sul web ha l'AI come prima.
- Le build firmate da Xcode producono token dell'ambiente di sviluppo: il
  server prova la produzione e poi lo sviluppo, quindi il telefono di prova
  funziona senza variabili in piu.
- Il simulatore non ha DeviceCheck (`isSupported` falso): li il regalo non
  parte. Si prova sul telefono.

## 4. Come si verifica che e acceso, e che la chiave e QUELLA GIUSTA

Da un browser qualunque: `curl -s -X POST https://dayalogue.com/api/ospite/braccialetto -H "x-jm-braccialetto: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" -H "content-type: application/json" -d '{}'`
deve rispondere `403 {"error":"solo_app", ...}`. Finche risponde
`200 {"esito":"nato"...}`, DeviceCheck e spento e il buco e aperto.

E la chiave? Si prova con un token INVENTATO (stessa riga, ma
`-d '{"token":"xxxxx"}'`):

- `403 {"error":"token_non_valido"}` -> **la chiave vale**: Apple ci ha
  riconosciuti e ha rifiutato il token, che infatti era finto.
- `503 {"error":"devicecheck_non_disponibile"}` -> **la chiave NON vale**
  (Key ID, Team ID o .p8 sbagliati, o chiave revocata): Apple risponde 401
  alla nostra firma. Da controllare subito, perche nessun iPhone riceverebbe
  il regalo. Il server risponde 503 e non spegne niente proprio per questo:
  un guasto nostro non deve diventare una porta chiusa in faccia alla
  persona.

Banco: `scripts/verify-devicecheck.mjs` (19 controlli, con un Apple
DeviceCheck finto).
