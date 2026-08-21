# Handover · Consumi AI (ramo `consumi-ai`)

Aggiornato al 21 agosto 2026. Scritto per chi riprende questo ramo senza
il contesto della conversazione in cui e nato.

Regola di sempre: se qui leggi qualcosa che il codice smentisce, vince il
codice — e poi correggi qui.

---

## 1. Cos'e

La schermata che dice quanto costa l'AI ogni mese, dentro Impostazioni.
Disegno approvato: `design/mockups/consumi-ai.html`. Non e stato
ridisegnato niente.

Non ha aggiunto ne migration ne rotte: `GET /api/usage` esisteva gia
(aggrega `ai_usage` sul mese corrente in UTC) e i listini stanno gia in
`src/lib/server/ai-usage.ts`. Questo ramo e **solo lettura e interfaccia**.

---

## 2. I file

| File | Cosa |
|---|---|
| `src/lib/data/usage.ts` | fetch via `apiFetch`, raggruppamento, niente testi |
| `src/components/consumi/consumi-panel.tsx` | `ConsumiRow` (la riga) + `ConsumiPanel` |
| `src/app/features.css` | tutto il CSS, classi `jm-cs-*` |
| `src/lib/i18n/en-extra.ts` | le 38 frasi inglesi |
| `scripts/verify-consumi.mjs` | la suite Playwright (31 controlli) |
| `src/components/settings/settings-client.tsx` | **file condiviso**: un import, la riga, il ramo di pannello. Commit separato |

---

## 3. Le decisioni, e perche

**Le voci sono attivita, non route.** Le sei route di `byRoute` diventano
quattro voci in italiano. `split-by-date`, `extract-people` e `classify`
sono una voce sola ("Persone, date e note di Ricorda") perche da fuori
sono un gesto solo: l'app che mette in ordine quello che hai raccontato.
Un elenco di nomi tecnici non fa decidere niente a nessuno.

**Una chiave assente vale zero.** `/api/usage` non manda le route senza
consumo. `summarizeUsage` salta le voci a zero chiamate invece di
disegnarle vuote.

**L'ordine e per costo, dal piu caro.** E l'unica informazione da cui si
decide qualcosa: l'audio si mangia tre quarti del conto e tutto il resto e
polvere. Ordinare per costo lo dice senza doverlo leggere.

**Il totale sta gia sulla riga di Impostazioni.** Chi apre il pannello lo
fa per il dettaglio, non per scoprire se ha speso.

**Una richiesta sola per visita.** Riga e pannello vogliono lo stesso dato:
`loadUsage()` tiene la promessa in un modulo. Un errore NON si mette in
cache, altrimenti "riprova" non riproverebbe niente.

**Sotto il centesimo si scrive "meno di 0,01 $".** "0,00 $" sembra gratis.

**La riga non esiste in modalita locale.** Non spenta con la targhetta
premium: assente. In locale l'AI non gira, e una riga spenta sarebbe solo
un modo elegante di dire di no a chi non puo dire di si. Doppia difesa:
`settings-client` non la monta, e `loadUsage` si rifiuta di partire se
`resolveStorageMode()` non risponde `cloud` — cosi la promessa "in locale
nemmeno una richiesta di rete" non dipende dal fatto che per caso nessuno
chiami quella funzione.

**L'errore si vede scritto**, con il dettaglio tecnico sotto e il bottone
riprova. Una schermata vuota dopo un 500 farebbe credere di non aver speso
niente: e la bugia peggiore che possa dire questa schermata.

**La nota resta dura.** Il conteggio dei token e esatto (sono quelli
ufficiali di OpenAI, loggati da ogni route); il prezzo e una stima su un
listino salvato ad agosto 2026; il conto vero e sul pannello OpenAI. Non
va ammorbidita: e la sola frase che impedisce di scambiare questa cifra
per una bolletta.

---

## 4. I due scostamenti dal mockup, e perche

1. **Il mese sta sotto l'intestazione, non dentro.** Nel mockup "Agosto
   2026, dal giorno 1" e il sottotitolo dell'header. L'header dei pannelli
   di Impostazioni e condiviso (`PanelHead` in `src/components/settings/rows.tsx`,
   file dell'altra sessione) e accetta solo un titolo. La riga del mese
   apre quindi il contenuto: stessa informazione, tre pixel piu in basso.
2. **Su desktop la riga sta nella rail destra, non in colonna centrale.**
   Il mockup mostra Piano + Consumi AI + Esci nella colonna centrale anche
   a 1440, ma il codice e andato avanti: da PR 10 l'identita su desktop
   vive nella rail destra e il gruppo Account della colonna centrale e
   `jm-st-phoneonly`. Autorizzato da Manuel il 21 agosto: la riga sta
   sotto "Piano" nella rail (`ConsumiRailRow`), che li e l'unica coppia
   chiave/valore cliccabile e quindi e un bottone vero, col chevron. Sul
   telefono resta dov'e nel mockup, dentro il gruppo Account sotto Piano.
   Il contenuto della rail e renderizzato da `settings-client.tsx`:
   `src/components/desktop/rail-right.tsx` e solo il contenitore e non e
   stato toccato.

---

## 5. Come si verifica

```bash
# dev server nella cartella di build, porta 3200
cd /tmp/jm-build-b && npx next dev -p 3200
node scripts/verify-consumi.mjs
```

31 controlli, tutti PASS il 21 agosto 2026. Cosa provano, in ordine di
importanza:

1. in modalita locale la riga non c'e e non parte **nessuna** richiesta
   esterna, ne verso `/api/usage`, su desktop e su telefono;
2. con un account cloud, totale, percentuali, conteggi umani e ordine
   corrispondono a una risposta finta di `/api/usage` (gli stessi numeri
   del mockup: 0,29 $, 76/14/7/3%);
3. nessun nome di route finisce a schermo;
4. lo stato vuoto dice perche e vuoto e non dice "nessun dato";
5. un 500 si vede scritto e non mostra nessun totale.

La sessione cloud e finta: un token non scaduto in `localStorage`
(`sb-example-auth-token`) basta a `getSession()` per rispondere senza
rete, e le chiamate a Supabase sono intercettate. Cosi il ramo cloud
diventa verificabile in sandbox, che prima non lo era (vedi la nota in
`scripts/verify-impostazioni.mjs`).

`npx tsc --noEmit`, `npx eslint .` e `node scripts/verify-i18n.mjs`
puliti.

---

## 6. Cosa NON e stato fatto

- **Niente storico.** Si vede solo il mese corrente, perche solo quello
  aggrega `/api/usage`. Un confronto col mese scorso vorrebbe dire toccare
  la rotta, che non e di questo ramo.
- **Niente conversione in euro.** Il listino di OpenAI e in dollari;
  convertirlo con un cambio inventato aggiungerebbe un secondo errore
  sopra a una stima.
- **Nessun tetto di spesa, nessun avviso.** Sarebbe una funzione, non una
  schermata, e va decisa a parte.

---

## 7. Trappola trovata strada facendo

Il commento in cima a `src/app/features.css` diceva che il file e
importato **in fondo** a `globals.css` e che quindi vince a parita di
specificita. Non e vero: e importato alla riga 6, cioe in cima, e a parita
di specificita vince `globals.css`. Il commento e stato corretto su questo
ramo. Chi scrive li usi classi sue e non conti sull'ordine.
