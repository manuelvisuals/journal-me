#!/bin/bash
# dayalogue - unisce un ramo dentro main e lo spinge su GitHub, SENZA toccare
# il ramo su cui stai lavorando adesso.
#
# Come lo fa, e perche cosi: il merge non avviene nella tua cartella ma in un
# WORKTREE temporaneo sotto /tmp, cioe una seconda copia dei file che condivide
# la stessa cronologia. La tua cartella non cambia ramo, non perde le modifiche
# aperte, e se il merge va storto non resta niente da rimettere a posto.
#
# Uso:
#   bash unisci-pr-su-main.command                      -> ramo claude/sito-2-0 (PR 71)
#   bash unisci-pr-su-main.command claude/altro-ramo 74 -> un altro ramo
#
# Perche non lo lancia Claude da solo: il permesso di SCRIVERE su GitHub sta
# nel portachiavi del tuo Mac. La sessione di Claude vede i file, e puo
# leggere da GitHub, ma quando prova a spingere GitHub le chiede chi e e lei
# non ha la risposta. Leggere si, scrivere no: e una riga sola, ed e questa.

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
  printf "${R}${B}  ESITO: NON E ANDATA. Copia le righe rosse qui sopra a Claude.${V}\n"
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
RAMO="${1:-claude/sito-2-0}"
NUMERO="${2:-71}"
W="/tmp/wt-main-$$"
LOG="$HOME/Desktop/unisci-pr-log.txt"
: > "$LOG"

printf "${B}dayalogue - unisco %s dentro main${V}\n\n" "$RAMO"

[ -d "$REPO/.git" ] || { ko "non trovo il repo in $REPO"; stop; }
cd "$REPO" || { ko "non riesco a entrare in $REPO"; stop; }
ok "cartella: $REPO"

RAMO_TUO=$(git rev-parse --abbrev-ref HEAD 2>>"$LOG")
info "il tuo ramo resta $RAMO_TUO, e non lo tocco"

# ---------- 0. lucchetti e worktree fantasma ----------
# Una sessione di Claude che gira dentro la cartella collegata puo lasciare
# un worktree registrato e un lucchetto che lei non ha il permesso di
# cancellare. prune toglie le registrazioni che puntano a cartelle sparite.
if [ -f ".git/index.lock" ] && [ -z "$(find .git/index.lock -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
  ko "c'e un .git/index.lock nato adesso: aspetta due minuti e rilancia"
  stop
fi
rm -f .git/index.lock .git/objects/maintenance.lock 2>/dev/null
git worktree prune >>"$LOG" 2>&1
ok "lucchetti e worktree vecchi ripuliti"

# ---------- 1. leggo GitHub ----------
info "leggo GitHub..."
con_tetto 90 git fetch origin >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -eq 124 ]; then
  ko "GitHub non risponde da 90 secondi: mi fermo."
  tail -6 "$LOG"; stop
elif [ "$ESITO" -ne 0 ]; then
  ko "non riesco a leggere GitHub. Git dice:"; tail -8 "$LOG"; stop
fi
ok "GitHub raggiunto"

git rev-parse --verify "origin/$RAMO" >/dev/null 2>&1 || { ko "su GitHub non esiste il ramo origin/$RAMO"; stop; }

if git merge-base --is-ancestor "origin/$RAMO" origin/main 2>/dev/null; then
  nota "$RAMO e GIA dentro main: non c'e niente da unire."
  echo
  printf "${G}${B}  ESITO: TUTTO OK (era gia fatto)${V}\n\n"
  read -n 1 -s -r -p "Premi un tasto per chiudere."; echo; exit 0
fi

QUANTI=$(git rev-list --count origin/main.."origin/$RAMO" 2>/dev/null)
ok "$QUANTI commit da portare in main"

# ---------- 2. il merge, in una copia a parte ----------
rm -rf "$W"
git worktree add --detach "$W" origin/main >>"$LOG" 2>&1 || { ko "non riesco a creare la copia temporanea"; tail -8 "$LOG"; stop; }
cd "$W" || { ko "non riesco a entrare nella copia temporanea"; stop; }

if ! git merge --no-ff --no-edit "origin/$RAMO" \
     -m "Merge pull request #$NUMERO from manuelvisuals/$RAMO" >>"$LOG" 2>&1; then
  git merge --abort >>"$LOG" 2>&1
  cd "$REPO" || true
  git worktree remove --force "$W" >>"$LOG" 2>&1
  git worktree prune >>"$LOG" 2>&1
  ko "il merge ha dei CONFLITTI: main e il ramo hanno cambiato le stesse righe."
  info "niente e stato spinto e la tua cartella non e stata toccata."
  info "ultime righe di git:"
  tail -12 "$LOG"
  stop
fi
ok "merge fatto (nella copia temporanea, non da te)"

# ---------- 3. su GitHub ----------
info "spingo su main: di solito meno di un minuto"
con_tetto 120 git push origin HEAD:main >>"$LOG" 2>&1
ESITO=$?
cd "$REPO" || true
git worktree remove --force "$W" >>"$LOG" 2>&1
git worktree prune >>"$LOG" 2>&1
if [ "$ESITO" -eq 124 ]; then
  ko "il push ci ha messo piu di due minuti: fermato (rete o permessi)."
  tail -10 "$LOG"; stop
elif [ "$ESITO" -ne 0 ]; then
  ko "il push e stato rifiutato. Git dice:"; tail -10 "$LOG"; stop
fi
ok "main aggiornato su GitHub"

RAMO_DOPO=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$RAMO_DOPO" != "$RAMO_TUO" ]; then
  wr "attenzione: il tuo ramo e cambiato da $RAMO_TUO a $RAMO_DOPO"
else
  ok "il tuo ramo e ancora $RAMO_TUO, intatto"
fi

echo
if [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  MAIN AGGIORNATO: Vercel sta pubblicando${V}\n\n"
else
  printf "${R}${B}  ESITO: %s PROBLEMA/I${V}\n\n" "$PROBLEMI"
fi
info "registro completo: $LOG"
echo
read -n 1 -s -r -p "Premi un tasto per chiudere."; echo
