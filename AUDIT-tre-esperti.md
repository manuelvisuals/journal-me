# Audit severo · Journal.me

Obiettivo dichiarato: inclusione nella prossima release di iOS 27. Standard di giudizio: nessuno spazio per app fatte male.

Metodo: ho ispezionato la schermata di login dal vivo (Chrome) e poi il codice di produzione reale (`src/`), perche il **Demo / App Tour e rotto** (risponde "Demo non disponibile") e mi ha impedito di entrare nelle altre schermate. Questo e gia il primo reperto.

Al tavolo: un designer senior in stile Apple, un esperto UX/UI con 20 anni di mestiere, un esperto di dettatura e riconoscimento vocale. Verdetto in fondo.

---

## Verdetto in una riga

Le fondamenta sono premium e l'ingegneria vocale e insolitamente curata — ma ci sono **tre blocker da rilascio** e diversi buchi di accessibilita che, allo stato attuale, **non passerebbero un esame di livello Apple**. Non pronta per iOS 27 finche i blocker non sono chiusi e verificati su device.

I tre blocker:
1. Il Demo non funziona → il momento della valutazione muore alla porta.
2. Il bug "registrazione muta al primo avvio" (iOS) e ancora aperto → il compito principale fallisce al primo utilizzo.
3. La waveform e finta, non collegata all'audio reale → feedback disonesto in un'app di dettatura.

---

## 1. Jony Ive — design e feel Apple

**Cosa e gia giusto.** La palette "vino/ambra su quasi-nero" (`#0E0709` + accent `#E3A15F`) e distintiva, calda, adulta. Le pressioni dei bottoni (`scale(0.97)`, transizioni 80ms) sono curate. La gerarchia tipografica Inter + Spectral e una scelta colta. Questo non e lavoro da dilettante.

**Dove sarei severo.**

- **Due rossi che litigano.** Nei controlli di registrazione convivono un cestino rosso (annulla) e un grande pulsante rosso 76px (stop/salva). Apple non metterebbe mai due cerchi rossi affiancati: il colore deve codificare significato. Qui l'azione **sicura e primaria** (termina e salva) e vestita con il rosso piu allarmante della UI, mentre l'azione **distruttiva** (cancella tutto) e un rosso piu piccolo accanto. Inversione semantica.
- **La waveform e decorativa, non vera.** Animazione CSS con altezze hardcoded, pilotata solo da `state === "recording"`. Balla anche nel silenzio. Per un designer Apple e peccato capitale: il feedback deve riflettere la realta (la waveform di Voice Memos e sacra proprio perche e onesta). Materiale disonesto.
- **Casing incoerente.** Convivono "Benvenuto", "Com'e andata oggi?" (Sentence case) e minuscole forzate da art-school: "live", "preparo il microfono", "Parla pure...", "audio in streaming a openai". La disciplina tipografica e parte del calm Apple. Scegli una voce sola.
- **Glow anni 2013.** Bottoni con aloni multipli (`0 0 36px rgba(accent,0.40)`) e hairline bianche calde: skeuomorfismo luminoso. Il linguaggio Apple attuale va verso traslucenza e sobrieta, non neon. L'alone ambra sul mic e troppo forte.
- **Icone ambigue.** "Oggi" e un mirino (croce + cerchio), poco leggibile come "oggi". "Altro" usa i tre puntini — che in Apple sono un menu overflow, non una destinazione di navigazione. Il mic centrale e privo di etichetta mentre i 4 fratelli ce l'hanno.
- **Niente griglia.** Spaziature a mano (`marginBottom: 64/14/20...`) invece di un ritmo 8pt. Si sente.
- **Una sola apparenza.** Nessun light mode, nessun rispetto dell'aspetto di sistema. Apple si aspetta parita Dark/Light o una scelta dichiarata.
- **Texture rumore + doppio glow** su OLED rischiano banding sui gradienti scuri.

## 2. Esperto UX/UI (20 anni)

- **Dead-end alla valutazione.** Il Demo e l'unico ingresso senza account ed e rotto. Il momento piu importante (qualcuno che prova l'app) fallisce subito. (Causa probabile: `DEMO_USER_PASSWORD` non configurata o utente demo rimosso su Supabase → la route restituisce 500.)
- **Reduce Motion ignorato.** Zero `prefers-reduced-motion` in tutto il CSS: waveform, puntini pulsanti e onde girano comunque. E una regressione di accessibilita e un rischio in review App Store.
- **L'app di dettatura non parla allo screen reader.** L'area trascrizione non e una `aria-live` region: in VoiceOver, mentre detti, non viene annunciato nulla. Ironico proprio qui. Le aria presenti sono quasi tutte `aria-hidden`.
- **Annulla = perdita irreversibile.** Il cestino scarta l'intera registrazione senza conferma ne undo. Un mistap su una nota vocale lunga = contenuto perso. Serve conferma o undo.
- **Mix di lingue.** UI in italiano ma la tab si chiama "Remember" (inglese). Stona: o "Ricorda", o si sceglie l'inglese ovunque.
- **Focus deboli.** Solo 2 stili `:focus` in tutto il CSS → tastiera/Switch Control mal serviti.
- **Cosa tenere:** i messaggi d'errore sono umani e azionabili ("Permesso microfono negato. Vai nelle impostazioni..."); l'avviso di silenzio dopo 8s e buon UX; la disclosure privacy esiste ed e onesta. Sono punti di forza reali.
- **Privacy poco visibile.** "audio in streaming a openai . solo il testo viene salvato" e a 11px sbiadito: giusto come sostanza, troppo timido come evidenza, da allineare alla privacy nutrition label.

## 3. Esperto dettatura / voce

- **L'architettura e seria.** OpenAI Realtime `gpt-4o-transcribe` su WebRTC, chiave solo lato server, prompt anti-allucinazione esplicito, `noise_reduction: near_field`, VAD `threshold 0.3`, e i nomi propri da Remember iniettati come vocabolario. Scelte mature e corrette. Bravo.
- **Ma il flusso di punta e rotto al primo avvio (iOS).** Stato `recording`, timer che scorre, zero trascrizione: documentato e ancora aperto (`HANDOVER-recording-bug.md`). Per un'app di dettatura e esistenziale: il compito principale fallisce alla primissima esperienza. Le mitigazioni (retry `getUserMedia`, wait-for-`unmute`) ci sono ma il bug e segnato come non chiuso. **Da chiudere e verificare su device prima di qualsiasi invio iOS 27.**
- **Feedback di input assente.** La waveform e finta: l'utente non ha modo di sapere se il mic lo sente — proprio mentre esiste un fallimento "muto". Collegala al livello reale (`getStats().audioLevel` o un `AnalyserNode` Web Audio). Oggi l'unico segnale vero arriva dopo 8 secondi.
- **Logprobs richiesti ma inutilizzati.** `include: ["...logprobs"]` viene chiesto e mai usato: potresti evidenziare le parole a bassa confidenza.
- **Diagnostica in produzione.** `console.log("[rec]", ...)` su ogni evento + `getStats()` ogni 2s sono ancora spediti live: rumore su batteria/perf/privacy. Rimuovere prima del rilascio.
- **Nessun fallback.** Se WebRTC fallisce, resta solo "scrivi a mano". iOS offre dettatura nativa: come rete di sicurezza vale considerarla.
- **Manca il tatto.** Nessun haptic su start/stop ne earcon — su iOS ci si aspetta un feedback aptico discreto all'avvio/stop della registrazione.
- **Cosa tenere:** il prewarm endpoint per la latenza; il wake-lock gestito bene (con re-acquire al ritorno in foreground); il trattamento trascrizione a tre toni (older/recent/interim) e elegante e aiuta la lettura. Ottimo.
- **Tarare la soglia silenzio.** 8s forse troppi: 4-5s rende il fallimento percepito prima.

---

## Backlog prioritizzato

**P0 — blocker, da chiudere prima di proporsi per iOS 27**
1. Riparare il Demo / App Tour (config `DEMO_USER_PASSWORD` / utente Supabase) — senza, nessuno puo valutare l'app.
2. Chiudere e verificare su device il bug "registrazione muta al primo avvio" iOS.
3. Collegare la waveform all'audio reale (livello da `getStats`/`AnalyserNode`); niente piu animazione finta.

**P1 — qualita Apple / accessibilita**
4. Aggiungere `prefers-reduced-motion` a tutte le animazioni.
5. Area trascrizione come `aria-live="polite"`; pass VoiceOver completo.
6. Conferma o undo sull'annulla registrazione (no perdita irreversibile).
7. Rimuovere il logging diagnostico e il poll `getStats` dalla produzione.
8. Sciogliere il conflitto dei due rossi (stop/save non deve essere il rosso piu forte).

**P2 — raffinatezza**
9. Uniformare il casing tipografico; decidere "Remember" vs "Ricorda".
10. Ridurre i glow neon verso un linguaggio piu sobrio/traslucido; ritmo 8pt.
11. Haptics + earcon su start/stop; valutare light mode.
12. Rivedere icone "Oggi" e "Altro" (mirino e overflow-dots come destinazioni).
13. Tarare soglia silenzio a 4-5s; valutare evidenza parole a bassa confidenza (logprobs).

---

*Nota di metodo: le schermate oltre il login non sono state ispezionate dal vivo perche il Demo era rotto; i giudizi su quelle viste si basano sul codice di produzione reale in `src/`. Per un secondo giro, accedi con magic link e ripeto l'audit visivo schermo per schermo.*
