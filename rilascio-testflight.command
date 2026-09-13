#!/bin/bash
# dayalogue - una build nuova su TestFlight, in un colpo solo.
#
# Cosa fa, in ordine:
#   1. si mette su main e tira le novita da GitHub;
#   2. alza il numero di build (CURRENT_PROJECT_VERSION) di uno, lo salva su
#      GitHub con un commit "Build N per TestFlight";
#   3. ricostruisce il pacchetto web dentro l'app (aggiorna-e-apri-xcode,
#      senza aprire Xcode);
#   4. archivia e carica su App Store Connect (archivia-e-carica).
#
# Uso:
#   clear; bash "$HOME/Developer/journal-me/rilascio-testflight.command"
#   clear; bash "$HOME/Developer/journal-me/rilascio-testflight.command" 7   -> forza la build 7
#
# I due script che chiama esistono gia e restano usabili da soli; questo li
# mette in fila con lo stdin chiuso (/dev/null), cosi i loro "premi un
# tasto" non fermano niente. Regole di REGOLE-TERMINALE.md: niente attese
# mute, tetto di tempo sulla rete, bash 3.2, verdetto unico in fondo.
#
# Nato il 13 settembre 2026 per la build 4 (nome "Dayalogue", splash animata,
# plugin Recensione.swift): fino alla 3 si faceva a mano, in due script.

clear
V="\033[0m"; G="\033[1;32m"; R="\033[1;31m"; Y="\033[1;33m"; B="\033[1m"; D="\033[2m"
PROBLEMI=0
ok(){ printf "${G}[OK] %s${V}\n" "$1"; }
ko(){ PROBLEMI=$((PROBLEMI+1)); printf "${R}[NO] %s${V}\n" "$1"; }
wr(){ PROBLEMI=$((PROBLEMI+1)); printf "${Y}[!!] %s${V}\n" "$1"; }
nota(){ printf "${Y}[..] %s${V}\n" "$1"; }
info(){ printf "${D}     %s${V}\n" "$1"; }
stop(){
  echo
  printf "${R}${B}  ESITO: %s PROBLEMA/I. Copia le righe rosse qui sopra a Claude.${V}\n" "$PROBLEMI"
  echo
  read -n 1 -s -r -p "Premi un tasto per chiudere."; echo; exit 1
}

export GIT_TERMINAL_PROMPT=0

con_tetto(){
  secondi="$1"; shift
  "$@" &
  pid=$!
  passati=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$passati" -ge "$secondi" ]; then
      kill -9 "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      return 124
    fi
    sleep 1
    passati=$((passati+1))
  done
  wait "$pid"
  return $?
}

REPO="$HOME/Developer/journal-me"
PBX="$REPO/ios/App/App.xcodeproj/project.pbxproj"
LOG="$HOME/Desktop/rilascio-testflight-log.txt"
: > "$LOG"

printf "${B}dayalogue - build nuova su TestFlight${V}\n\n"

[ -d "$REPO/.git" ] || { ko "non trovo il repo in $REPO"; stop; }
cd "$REPO" || { ko "non riesco a entrare in $REPO"; stop; }
[ -f "$PBX" ] || { ko "non trovo il progetto Xcode ($PBX)"; stop; }
ok "cartella: $REPO"

# ---------- 0. lucchetti ----------
if [ -f ".git/index.lock" ] && [ -z "$(find .git/index.lock -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
  ko "c'e un .git/index.lock nato adesso: aspetta due minuti e rilancia"
  stop
fi
rm -f .git/index.lock .git/HEAD.lock .git/objects/maintenance.lock 2>/dev/null
git worktree prune >>"$LOG" 2>&1

# ---------- 1. main, aggiornato ----------
info "leggo GitHub (al massimo 90 secondi)..."
con_tetto 90 git fetch origin >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -eq 124 ]; then ko "GitHub non risponde da 90 secondi: mi fermo."; tail -6 "$LOG"; stop; fi
if [ "$ESITO" -ne 0 ]; then ko "non riesco a leggere GitHub. Git dice:"; tail -8 "$LOG"; stop; fi
ok "GitHub raggiunto"

# Il pacchetto dentro ios/ e generato ma versionato: si rimette com'e su
# GitHub prima di cambiare ramo, tanto lo rifacciamo fra un minuto.
git checkout -- ios/App/App/public package-lock.json >>"$LOG" 2>&1
git clean -fdq ios/App/App/public >>"$LOG" 2>&1

SPORCO=$(git status --porcelain | grep -v "^?? " | head -5)
if [ -n "$SPORCO" ]; then
  ko "ci sono modifiche non salvate nella cartella: le vedi qui sotto. Mettile al sicuro (o dillo a Claude) e rilancia."
  printf "%s\n" "$SPORCO"
  stop
fi

git checkout main >>"$LOG" 2>&1 || { ko "non riesco a mettermi su main. Git dice:"; tail -6 "$LOG"; stop; }
con_tetto 120 git pull --ff-only origin main >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -eq 124 ]; then ko "il pull non e tornato entro due minuti."; tail -6 "$LOG"; stop; fi
if [ "$ESITO" -ne 0 ]; then ko "il pull non e riuscito. Git dice:"; tail -8 "$LOG"; stop; fi
ok "main aggiornato ($(git rev-parse --short HEAD))"

# ---------- 2. il numero di build ----------
ATTUALE=$(grep -m1 "CURRENT_PROJECT_VERSION" "$PBX" | sed 's/.*= *//; s/;//' | tr -d ' ')
case "$ATTUALE" in
  ''|*[!0-9]*) ko "non leggo il numero di build attuale dal progetto (trovato: '$ATTUALE')"; stop ;;
esac
if [ -n "$1" ]; then
  NUOVA="$1"
  case "$NUOVA" in ''|*[!0-9]*) ko "il numero di build deve essere un intero (hai scritto '$1')"; stop ;; esac
  [ "$NUOVA" -gt "$ATTUALE" ] || { ko "la build $NUOVA non e piu alta della $ATTUALE: Apple la rifiuterebbe"; stop; }
else
  NUOVA=$((ATTUALE+1))
fi
VER=$(grep -m1 "MARKETING_VERSION" "$PBX" | sed 's/.*= *//; s/;//' | tr -d ' ')
info "versione $VER: dalla build $ATTUALE alla $NUOVA"

# Tutte le occorrenze (Debug e Release hanno la stessa riga).
sed -i '' "s/CURRENT_PROJECT_VERSION = $ATTUALE;/CURRENT_PROJECT_VERSION = $NUOVA;/g" "$PBX"
QUANTE=$(grep -c "CURRENT_PROJECT_VERSION = $NUOVA;" "$PBX")
[ "$QUANTE" -ge 1 ] || { ko "non sono riuscito a scrivere il numero nuovo nel progetto"; stop; }
ok "numero di build scritto ($QUANTE righe)"

git add "ios/App/App.xcodeproj/project.pbxproj" >>"$LOG" 2>&1
git -c user.email=spamming.madh52@gmail.com -c user.name="Manuel" commit -q -m "Build $NUOVA per TestFlight" >>"$LOG" 2>&1 \
  || { ko "il commit del numero di build non e riuscito. Git dice:"; tail -6 "$LOG"; stop; }
info "salvo su GitHub..."
con_tetto 120 git push origin main >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -eq 124 ]; then ko "il push non e tornato entro due minuti (rete o permessi)."; tail -6 "$LOG"; stop; fi
if [ "$ESITO" -ne 0 ]; then ko "il push e stato rifiutato. Git dice:"; tail -8 "$LOG"; stop; fi
ok "Build $NUOVA salvata su GitHub"

# ---------- 3. il pacchetto web dentro l'app ----------
echo
info "3/4 ricostruisco il pacchetto (aggiorna-e-apri-xcode, senza aprire Xcode): qualche minuto..."
JM_SENZA_XCODE=1 bash "$REPO/aggiorna-e-apri-xcode.command" < /dev/null
ESITO=$?
if [ "$ESITO" -ne 0 ]; then
  ko "la ricostruzione del pacchetto si e fermata (vedi le righe rosse qui sopra)"
  stop
fi
ok "pacchetto pronto"

# ---------- 4. archivio e caricamento ----------
echo
info "4/4 archivio e carico su App Store Connect (archivia-e-carica): 5-15 minuti..."
bash "$REPO/archivia-e-carica.command" < /dev/null
ESITO=$?
if [ "$ESITO" -ne 0 ]; then
  ko "l'archivio o il caricamento si sono fermati (vedi le righe rosse qui sopra)"
  stop
fi

echo
if [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  ESITO: TUTTO OK. Build %s (versione %s) caricata: Apple la elabora in 5-15 minuti, poi compare su TestFlight.${V}\n\n" "$NUOVA" "$VER"
else
  printf "${R}${B}  ESITO: %s PROBLEMA/I${V}\n\n" "$PROBLEMI"
fi
info "registro: $LOG (e quelli dei due script sul Desktop)"
echo
read -n 1 -s -r -p "Premi un tasto per chiudere."; echo
