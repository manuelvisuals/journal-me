#!/bin/bash
# dayalogue - manda i nove temi regalati su GitHub e prepara la pull request.
# Doppio clic, oppure incolla nel Terminale la riga che ti ha dato Claude.
#
# Cosa fa, in ordine: controlla la cartella e il ramo, fa girare i banchi
# (tipi, i nove temi, traduzioni), mette in salvo SOLO i file dei temi
# (niente ios/, niente roba di lavoro), e spinge il ramo su GitHub.
# Alla fine ti stampa il link per aprire la pull request.

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
RAMO="temi-regalo-schede"
LOG="$HOME/Desktop/temi-regalati-log.txt"
: > "$LOG"

printf "${B}dayalogue - i nove temi regalati vanno su GitHub${V}\n\n"

# ---------- 0. la cartella ----------
if [ ! -d "$REPO/.git" ]; then
  ko "non trovo il repo in $REPO"
  stop
fi
cd "$REPO" || { ko "non riesco a entrare in $REPO"; stop; }
ok "cartella: $REPO"

# ---------- 0b. il lucchetto dimenticato ----------
# Un .git/index.lock orfano blocca ogni comando git. Si toglie solo se e
# fermo da piu di due minuti E nessun git sta girando.
if [ -f ".git/index.lock" ]; then
  if pgrep -x git >/dev/null 2>&1; then
    ko "c'e un git in esecuzione: aspetta che finisca e rilancia"
    stop
  fi
  if [ -z "$(find .git/index.lock -mmin +2 2>/dev/null)" ]; then
    ko "c'e un .git/index.lock recente: aspetta due minuti e rilancia"
    stop
  fi
  rm -f .git/index.lock
  nota "tolto un .git/index.lock orfano"
fi

# ---------- 1. il ramo ----------
RAMO_ORA=$(git rev-parse --abbrev-ref HEAD 2>>"$LOG")
if [ "$RAMO_ORA" != "$RAMO" ]; then
  ko "sei sul ramo \"$RAMO_ORA\", non su \"$RAMO\""
  info "i temi sono stati scritti sul ramo $RAMO. Passa a quello e rilancia."
  stop
fi
ok "ramo: $RAMO"

# ---------- 2. i file ci sono tutti? ----------
FILE="src/themes/ardesia.ts src/themes/korall.ts src/themes/ametista.ts \
src/themes/tokyo.ts src/themes/nord.ts src/themes/gruvbox.ts \
src/themes/catppuccin.ts src/themes/grafit.ts src/themes/ocean.ts \
src/themes/index.ts src/fonts/OFL.txt \
SPEC-temi-regalati.md LICENZE-TERZE-PARTI.md REFERTO-temi-regalati.html \
scripts/verify-temi-regalati.mjs \
manda-i-temi-su-github.command vedi-i-temi-sul-telefono.command"
MANCA=""
for f in $FILE; do
  [ -f "$f" ] || MANCA="$MANCA $f"
done
if [ -n "$MANCA" ]; then
  ko "mancano dei file:$MANCA"
  stop
fi
ok "diciassette file al loro posto"

# ---------- 3. i banchi ----------
echo
info "controllo dei tipi (npx tsc): un paio di minuti, sta zitto mentre lavora"
con_tetto 300 npx --no-install tsc --noEmit >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -eq 124 ]; then
  ko "il controllo dei tipi ci ha messo piu di cinque minuti: fermato"
  tail -n 20 "$LOG"
  stop
elif [ "$ESITO" -ne 0 ]; then
  ko "il controllo dei tipi ha trovato errori"
  tail -n 20 "$LOG"
  stop
fi
ok "tipi a posto"

info "banco dei nove temi"
con_tetto 120 node scripts/verify-temi-regalati.mjs >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -ne 0 ]; then
  ko "il banco dei temi e rosso"
  tail -n 25 "$LOG"
  stop
fi
ok "banco dei temi: 32/32"

info "banco delle traduzioni"
con_tetto 120 node scripts/verify-i18n.mjs >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -ne 0 ]; then
  ko "il banco delle traduzioni e rosso"
  tail -n 25 "$LOG"
  stop
fi
ok "banco delle traduzioni: 7/7"

# ---------- 4. il salvataggio ----------
# Solo i file elencati: la cartella ha un mucchio di roba di lavoro
# (ios/, node_modules, worktree di vecchie chat) che NON deve entrare.
echo
git add $FILE >>"$LOG" 2>&1 || { ko "git add fallito"; tail -n 10 "$LOG"; stop; }

if git diff --cached --quiet; then
  nota "non c'e niente di nuovo da salvare: era gia tutto committato"
else
  git commit -q -m "I nove temi regalati entrano nell'app" \
    -m "Nove file in src/themes/ coi valori gia verificati della spec, registrati in index.ts. Il tema di fabbrica non cambia. Le licenze delle palette pubbliche e la provenienza per esteso di Ametista stanno in LICENZE-TERZE-PARTI.md; il banco scripts/verify-temi-regalati.mjs tiene insieme valori, contrasto, registro e obblighi di licenza." \
    >>"$LOG" 2>&1 || { ko "git commit fallito"; tail -n 15 "$LOG"; stop; }
  ok "salvato il commit dei temi"
fi

# ---------- 5. su GitHub ----------
echo
info "mando il ramo su GitHub: di solito meno di un minuto"
con_tetto 120 git push -u origin "$RAMO" >>"$LOG" 2>&1
ESITO=$?
if [ "$ESITO" -eq 124 ]; then
  ko "il push ci ha messo piu di due minuti: fermato (rete o credenziali)"
  tail -n 15 "$LOG"
  stop
elif [ "$ESITO" -ne 0 ]; then
  ko "il push e stato rifiutato"
  tail -n 15 "$LOG"
  stop
fi
ok "ramo $RAMO su GitHub"

# ---------- 6. il verdetto ----------
echo
if [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  ESITO: TUTTO OK${V}\n\n"
  printf "  Apri la pull request qui:\n"
  printf "  ${B}https://github.com/manuelvisuals/journal-me/compare/main...%s?expand=1${V}\n\n" "$RAMO"
  printf "  ${D}Il registro completo di questa esecuzione: %s${V}\n\n" "$LOG"
else
  printf "${R}${B}  ESITO: %s PROBLEMA/I${V}\n\n" "$PROBLEMI"
fi
read -n 1 -s -r -p "Premi un tasto per chiudere."; echo
