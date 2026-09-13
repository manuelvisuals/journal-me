#!/bin/bash
# dayalogue - unisce PIU rami dentro main, in fila, con un solo push.
#
# E il fratello di unisci-pr-su-main.command (un ramo per volta): stessa
# idea, il merge avviene in una copia temporanea sotto /tmp, la tua
# cartella non cambia ramo e non perde niente. Se un ramo ha conflitti, ci
# si ferma PRIMA di spingere: main su GitHub resta com'era.
#
# Uso:
#   clear; bash "$HOME/Developer/journal-me/unisci-giro.command"
#     -> i rami del giro del 13 settembre 2026 (elenco RAMI qui sotto)
#   clear; bash "$HOME/Developer/journal-me/unisci-giro.command" ramo-a ramo-b
#     -> altri rami, nell'ordine dato
#
# Regole di REGOLE-TERMINALE.md: niente attese mute, tetto di tempo sulla
# rete, bash 3.2, verdetto unico in fondo.

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
W="/tmp/wt-giro-$$"
LOG="$HOME/Desktop/unisci-giro-log.txt"
: > "$LOG"

# I rami del giro, nell'ordine in cui vanno uniti.
if [ "$#" -gt 0 ]; then
  RAMI="$*"
else
  RAMI="nome-app-maiuscolo splash-marchio-animato rail-marchio-centrato admin-iscritti-mockup admin-iscritti"
fi

printf "${B}dayalogue - unisco in main, in fila:${V}\n"
for r in $RAMI; do info "  $r"; done
echo

[ -d "$REPO/.git" ] || { ko "non trovo il repo in $REPO"; stop; }
cd "$REPO" || { ko "non riesco a entrare in $REPO"; stop; }
ok "cartella: $REPO"

RAMO_TUO=$(git rev-parse --abbrev-ref HEAD 2>>"$LOG")
info "il tuo ramo resta $RAMO_TUO, e non lo tocco"

# ---------- 0. lucchetti e worktree fantasma ----------
if [ -f ".git/index.lock" ] && [ -z "$(find .git/index.lock -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
  ko "c'e un .git/index.lock nato adesso: aspetta due minuti e rilancia"
  stop
fi
rm -f .git/index.lock .git/HEAD.lock .git/objects/maintenance.lock 2>/dev/null
git worktree prune >>"$LOG" 2>&1
ok "lucchetti e worktree vecchi ripuliti"

# ---------- 1. leggo GitHub ----------
info "leggo GitHub (al massimo 90 secondi)..."
con_tetto 90 git fetch origin >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -eq 124 ]; then
  ko "GitHub non risponde da 90 secondi: mi fermo."
  tail -6 "$LOG"; stop
elif [ "$ESITO" -ne 0 ]; then
  ko "non riesco a leggere GitHub. Git dice:"; tail -8 "$LOG"; stop
fi
ok "GitHub raggiunto"

DA_UNIRE=""
for r in $RAMI; do
  if ! git rev-parse --verify "origin/$r" >/dev/null 2>&1; then
    wr "su GitHub non esiste il ramo origin/$r: lo salto"
    continue
  fi
  if git merge-base --is-ancestor "origin/$r" origin/main 2>/dev/null; then
    nota "$r e GIA dentro main: niente da unire"
    continue
  fi
  QUANTI=$(git rev-list --count origin/main.."origin/$r" 2>/dev/null)
  ok "$r: $QUANTI commit da portare in main"
  DA_UNIRE="$DA_UNIRE $r"
done

if [ -z "$DA_UNIRE" ]; then
  echo
  if [ "$PROBLEMI" -eq 0 ]; then
    printf "${G}${B}  ESITO: TUTTO OK (era gia tutto in main)${V}\n\n"
  else
    printf "${R}${B}  ESITO: %s PROBLEMA/I${V}\n\n" "$PROBLEMI"
  fi
  read -n 1 -s -r -p "Premi un tasto per chiudere."; echo; exit 0
fi

# ---------- 2. i merge, in una copia a parte ----------
rm -rf "$W"
git worktree add --detach "$W" origin/main >>"$LOG" 2>&1 || { ko "non riesco a creare la copia temporanea"; tail -8 "$LOG"; stop; }
cd "$W" || { ko "non riesco a entrare nella copia temporanea"; stop; }

for r in $DA_UNIRE; do
  if ! git -c user.email=spamming.madh52@gmail.com -c user.name="Manuel" merge --no-ff --no-edit "origin/$r" \
       -m "Merge branch $r into main" >>"$LOG" 2>&1; then
    git merge --abort >>"$LOG" 2>&1
    cd "$REPO" || true
    git worktree remove --force "$W" >>"$LOG" 2>&1
    git worktree prune >>"$LOG" 2>&1
    ko "il ramo $r ha dei CONFLITTI con main: mi fermo qui."
    info "niente e stato spinto e la tua cartella non e stata toccata."
    info "ultime righe di git:"
    tail -12 "$LOG"
    stop
  fi
  ok "$r unito (nella copia temporanea)"
done

# ---------- 3. su GitHub, un push solo ----------
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
ok "main aggiornato su GitHub: Vercel sta pubblicando (un paio di minuti)"

# ---------- 4. anche la tua cartella, se e su main e pulita ----------
if [ "$RAMO_TUO" = "main" ]; then
  if [ -z "$(git status --porcelain -- src scripts design public 2>/dev/null)" ]; then
    con_tetto 120 git pull --ff-only origin main >>"$LOG" 2>&1 && ok "la tua cartella e allineata a main" || wr "non sono riuscito ad allineare la tua cartella: fai tu un pull"
  else
    nota "la tua cartella ha modifiche non salvate: non la tocco (git pull quando vuoi)"
  fi
else
  nota "la tua cartella e sul ramo $RAMO_TUO: non la tocco"
fi

echo
if [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  ESITO: TUTTO OK${V}\n\n"
  info "fra due minuti: dayalogue.com/app (splash animata, rail) e dayalogue.com/admin (Iscritti)."
  info "per il telefono serve una build nuova: te la preparo a parte."
else
  printf "${R}${B}  ESITO: %s PROBLEMA/I${V}\n\n" "$PROBLEMI"
fi
info "registro completo: $LOG"
echo
read -n 1 -s -r -p "Premi un tasto per chiudere."; echo
