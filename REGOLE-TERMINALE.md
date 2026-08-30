# Regole per dare a Manuel un comando da Terminale

Contratto per qualunque chat che debba far eseguire qualcosa a Manuel sul suo Mac.
Scritto il 30 agosto 2026 dopo un blocco di dieci minuti a schermo muto.
Se una regola qui contraddice la tua memoria, vince questa pagina.

## 0. Precondizione

Default: NON si chiede a Manuel di aprire il Terminale (regola operativa 2,
HANDOVER §4). Si passa da un `.command` cliccabile, o lo esegui tu nel sandbox.
Queste regole valgono quando e Manuel a chiedere esplicitamente il comando.

## 1. Forma del comando consegnato

- UNA riga, copia-incolla, niente passi numerati da eseguire a mano.
- Inizia con `clear;`.
- Thin wrapper su uno script versionato nel repo. Non si consegnano pipeline
  inventate al momento: la logica vive in un file, non nella chat.
- Path assoluti via `$HOME`. Mai `cd` a carico suo, mai path relativi.
- Niente segreti nel testo che incolla (PAT, chiavi): finisce nella history.

Forma canonica:

    clear; bash "$HOME/Developer/journal-me/aggiorna-e-apri-xcode.command"

## 2. Divieto di attesa muta

Causa radice del blocco del 30 agosto: `git fetch origin >/dev/null 2>&1`.
Git chiedeva credenziali su un fd scartato. Zero output, attesa illimitata.

- MAI `>/dev/null 2>&1` su un comando che puo chiedere input o fallire.
  Redirigi su un log e ristampalo (`tail`) nel ramo di errore.
- `export GIT_TERMINAL_PROMPT=0` prima di qualunque git di rete: fallisce
  subito e dice perche, invece di aspettare.
- Nessun comando puo bloccarsi su stdin. `npm install --no-audit --no-fund`,
  `npx --no-install` (senza `--no-install` npx chiede "Ok to proceed? (y)").
- L'unico `read` ammesso e quello finale "premi un tasto per chiudere".
- Ogni passo lungo stampa cosa sta facendo PRIMA di partire, con l'ordine di
  grandezza atteso ("un paio di minuti"). Minuti senza output = sembra rotto.

## 3. Tetto di tempo su tutto cio che puo appendersi

`timeout` su macOS non esiste (e in coreutils, non di serie). Helper a mano,
gia nel repo (`aggiorna-e-apri-xcode.command`, funzione `con_tetto`):

    con_tetto(){
      secondi="$1"; shift
      "$@" &
      pid=$!
      passati=0
      while kill -0 "$pid" 2>/dev/null; do
        if [ "$passati" -ge "$secondi" ]; then
          kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; return 124
        fi
        sleep 1; passati=$((passati+1))
      done
      wait "$pid"; return $?
    }

- 124 = scaduto, ed e un ramo di errore SUO, con messaggio diverso dal
  fallimento normale. Non confondere "non risponde" con "ha detto di no".
- Tetti attuali: fetch 90s, pull 120s, npm install 900s, build 900s, sync 300s.
- Prima di consegnare: prova l'helper sui cinque casi (successo veloce,
  fallimento con codice proprio, lento ma dentro il tetto, appeso oltre il
  tetto, con redirezione su file).

## 4. Target bash 3.2

`/bin/bash` su macOS e 3.2.57. Vietati: array associativi, `mapfile`,
`${x^^}`, `&>`, `local` dove non serve. `bash -n <file>` prima di consegnare,
sempre. Uno script che non hai controllato non si consegna.

## 5. Verdetto unico in fondo

Manuel non deve rileggere venti righe per sapere se e andata.

- Contatore `PROBLEMI`; lo incrementano `ko()` e `wr()`.
- Un livello giallo che NON conta (`nota()`) per cio che va detto e non rompe.
- Ultima riga: `ESITO: TUTTO OK` verde, oppure `ESITO: N PROBLEMA/I` rosso.
- Anche l'uscita anticipata (`stop`) stampa il verdetto rosso. Nessun ramo
  esce in silenzio.
- Ogni riga rossa dice cosa incollare a Claude.

## 6. Diagnosi vere, non indovinate

Il messaggio "GitHub non raggiungibile. Controlla la rete" era FALSO: la rete
funzionava, il fetch era in coda su un lock. Un messaggio d'errore inventato
dallo script manda Manuel a cercare nel posto sbagliato.

- Il testo dell'errore lo produce lo strumento, non lo script. Ristampa
  l'output vero e semmai aggiungi una dritta ("se parla di Username o
  Authentication, allora...").
- Prima di dichiarare una causa, verificala. Un `git fetch` a mano che torna
  0 smentisce "rete assente".

## 7. Concorrenza col ponte verso il Mac

Se la tua sessione ha la cartella collegata e ci esegue git, il git di Manuel
sullo stesso `.git` si mette in coda e sembra appeso. E successo: dieci minuti
di attesa e poi un errore fuorviante.

- Mentre Manuel esegue lo script, la sessione NON tocca la cartella collegata.
  Dichiaralo prima ("da adesso sto ferma") e rispettalo.
- Se lo script si e appeso senza motivo, sospetta prima la concorrenza, poi
  la rete.

## 8. Script dentro il repo che lo script aggiorna

Il `.command` vive nel repo che sta tirando. Dopo il pull confronta lo
`shasum` di `$0`: se e cambiato, `exec bash "$0"`. Senza, bash legge le righe
successive da un file diverso da quello con cui e partito. Avvisa Manuel che
il riavvio singolo e normale.

## 9. Verifiche prima di consegnare

- `bash -n` pulito.
- Helper del tetto provato sui cinque casi.
- Se puoi eseguire lo script (o le sue parti) nel sandbox, fallo.
- Cio che NON hai potuto provare (Xcode, iPhone, dialoghi macOS) si dichiara
  esplicitamente. Un "fatto" non verificato e una bugia.

## 10. Stile

Niente emoji, apostrofi ASCII, italiano. Le istruzioni post-esecuzione sono
esplicite e ordinate (collega il cavo, scegli il telefono, premi Play,
aspetta che l'app si apra da sola).
