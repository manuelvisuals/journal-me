# Referto · Bug registrazione silenziosa al primo avvio (iOS)

Documento di passaggio per la chat che riprende l'indagine. Scritto 2026-05-24.
Commit di riferimento su `main`: **a414ac4**.

---

## 1. Il sintomo

Manuel, su iPhone, **primo avvio dell'app + primo inserimento dati della giornata**
(quindi primissima richiesta del permesso microfono), apre l'overlay di
registrazione e parla normalmente davanti al telefono. Risultato:

- Lo stato arriva a `recording`, il timer scorre (visto fino a 00:12).
- Nessun delta/completion di trascrizione arriva: dopo 8s scatta il warning
  "non ho ancora sentito parole. avvicinati al microfono...".
- L'indicatore microfono di iOS era acceso: a livello di sistema il mic captava.

Conferma di Manuel: "io stavo parlando e il microfono sentiva". Quindi **non è
hardware** — è la pipeline software del sito che non porta l'audio a OpenAI, o
OpenAI che non risponde.

ATTENZIONE a un possibile depistaggio: la `Waveform` nell'overlay **non è
collegata all'audio reale**, è un'animazione finta pilotata solo da
`state === "recording"`. Vederla muoversi NON prova che l'audio arrivasse.

---

## 2. Cos'è stato fatto in questa chat (commit a414ac4)

File toccato: `src/components/today/recording-overlay.tsx` (solo questo).

Due cose:

### a) Pannello diagnostico a schermo (TEMPORANEO — da rimuovere a fix trovato)
Un box in alto, badge "DEBUG", scrollabile, che logga in tempo reale ogni
passo della pipeline. Stesse righe vanno anche in `console.log("[rec]", ...)`.
Serve a vedere ESATTAMENTE dove si rompe al prossimo repro, invece di tirare a
indovinare.

### b) Tentativo di fix (NON dimostrato): attesa `unmute` della traccia
Prima dell'handshake WebRTC, se la traccia mic è `muted`, si aspetta l'evento
`unmute` (timeout di sicurezza 3s) via `waitForTrackLive()`. Ipotesi: al primo
grant iOS restituisce una traccia ancora `muted` e negoziare in quello stato
"blocca" il sender sul silenzio.

**Onestà intellettuale:** questa fix è un irrobustimento plausibile ma
**potrebbe non essere la causa vera**. Di norma, appena la traccia fa `unmute`
l'audio ricomincia a fluire da solo, quindi parlando 12s qualche trascrizione
sarebbe dovuta arrivare comunque. Il fatto che non sia arrivato NIENTE suggerisce
che il blocco sia altrove. Per questo il pannello diagnostico è la parte
importante: prima si conferma la causa, POI si dichiara risolto.

---

## 3. Come leggere il pannello (la parte che conta)

Fai ripetere il repro a Manuel (vedi sezione 4) e fatti leggere/screenshottare
le righe. Sequenza attesa di una sessione sana, con interpretazione:

| Riga nel pannello | Significato | Se manca / è anomala |
|---|---|---|
| `setup start` | effetto montato | overlay non monta |
| `getUserMedia ok muted=... enabled=... ready=...` | mic acquisito; nota `muted=true/false` | se `muted=true` al primo grant → ipotesi sezione 2b plausibile |
| `track muted -> waiting unmute` / `track UNMUTE` / `done waiting` | l'attesa unmute ha agito | se resta muted e scade il timeout → traccia non parte mai |
| `addTrack done` | traccia aggiunta al PeerConnection | — |
| `POST /api/realtime/session` → `session resp 200` | handshake col backend OK | status != 200 → problema server/OpenAI key/SDP |
| `remoteDescription set` | answer applicata | — |
| `ice=checking` → `ice=connected` | connessione WebRTC stabilita | resta `checking`/`failed` → problema rete/ICE |
| `pc.connectionState=connected` | idem | — |
| `datachannel OPEN` | canale eventi aperto | **se non appare mai → gli eventi OpenAI non possono arrivare. Forte sospetto.** |
| `ev session.created` / `ev ...speech_started` / `ev ...transcription.delta` | OpenAI risponde e trascrive | vedi sotto |
| `stats out pkts=N bytes=M lvl=X` (ogni 2s) | **il browser STA inviando audio?** | vedi sotto — è il discriminante chiave |

### La domanda decisiva: `stats out`
- **bytes/pkts CRESCONO nel tempo** (e `lvl` > 0 quando parli): il browser invia
  audio reale. Allora il problema è **lato OpenAI / configurazione sessione**
  (es. VAD, formato, lingua, o il datachannel non riceve gli eventi). Guarda se
  arrivano `ev ...`: se nessun `ev` arriva ma l'audio parte, è il canale eventi
  o la sessione di trascrizione.
- **bytes/pkts RESTANO PIATTI** (o `lvl` sempre 0 mentre parli): il browser
  **non invia audio**. La traccia non alimenta il sender → l'ipotesi traccia
  muted / track non agganciata è quella giusta, e va sistemata in modo robusto
  (es. ri-negoziare dopo unmute, o `replaceTrack`, o ricreare la traccia).

### Se arrivano `ev` ma sono solo errori
Se vedi `ev error` o simili, OpenAI sta rifiutando qualcosa nella
`sessionConfig` (vedi `src/app/api/realtime/session/route.ts`): modello
`gpt-4o-transcribe`, `language: "it"`, `noise_reduction near_field`,
`turn_detection server_vad threshold 0.3`. In quel caso il problema è la config,
non il primo-avvio.

---

## 4. Come riprodurre DAVVERO il primo-avvio

Il bug è specifico del **primissimo grant** del permesso microfono. Se Manuel ha
già concesso il permesso, la traccia parte già `unmuted` e il bug NON si
riproduce. Per un repro pulito serve resettare il permesso:

- Safari iOS: Impostazioni → Safari → (per-sito) o "Cancella dati siti e
  cronologia"; oppure rimuovere/ri-aggiungere la PWA dalla Home se installata.
- In alternativa, leggere il pannello/console via **Safari Web Inspector**
  collegando l'iPhone al Mac (Sviluppo → [iPhone] → la scheda dell'app).

Senza reset del permesso, la traccia sarà già `muted=false` e confermerai solo
il caso "sano".

---

## 5. Prossimi passi consigliati

1. Far riprodurre a Manuel il primo-avvio e raccogliere le righe del pannello.
2. Usare la tabella sezione 3 per localizzare il punto di rottura.
3. In base all'esito:
   - audio piatto → fix robusta lato traccia/sender (non basta l'attesa unmute);
   - audio ok ma nessun `ev` → indagare datachannel / sessione OpenAI;
   - `ev error` → correggere `sessionConfig` nel route.
4. **Quando la causa è confermata e risolta: RIMUOVERE tutta la diagnostica**
   (helper `dbg`, `startStatsPoll`, gli `addEventListener` di log, il pannello
   DEBUG in fondo al JSX, e gli stati `debugLines`/`debugOpen`). Sono marcati nel
   codice con commenti "TEMPORARY DIAGNOSTICS".
5. Decidere se tenere `waitForTrackLive` (innocuo) o rimuoverlo se irrilevante.

---

## 6. Note operative

- File: `src/components/today/recording-overlay.tsx`.
- Backend relay + config OpenAI: `src/app/api/realtime/session/route.ts`.
- Prewarm (non tocca il mic): `src/lib/realtime/prewarm.ts`.
- `tsc --noEmit` era pulito sul file modificato al momento del push (gli errori
  `node 2`/`react 2` sono cartelle `@types` duplicate dal mount, ignorarli).
- ESLint non eseguibile nel sandbox (node_modules del mount incompleto, .bin
  symlink rotti) — verificare ESLint da ambiente sano se serve.
- Push fatto via clone fresco in `/tmp` (vedi HANDOVER.md sez. 5-6); la `.git`
  nella workspace folder è solo lo scaffold iniziale, NON è la storia vera.
- Token PAT usato e poi da revocare (ricordato a Manuel).
