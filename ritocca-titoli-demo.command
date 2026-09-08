#!/bin/bash
# dayalogue - ritocca i titoli delle giornate dell'account demo (Sentence case).
# Doppio clic, oppure: clear; bash "$HOME/Developer/journal-me/ritocca-titoli-demo.command"
#
# COSA FA (9 settembre 2026). L'AI aveva scritto i 26 titoli di agosto tutti
# minuscoli ("marco measures shop for new layout"). Manuel ha scelto il
# Sentence case (PR #88 per le giornate nuove). Questo script apre la finestra
# di Chrome dell'account demo (profilo suo, ~/.dayalogue-demo-chrome, gia
# dentro) e mette su ogni giornata il titolo di demo/giulia-titoli-en.json col
# lucchetto, come farebbe una persona. Non tocca testo, aree, memo, recap.
# Due minuti circa. NON toccare la finestra di Chrome mentre lavora.
# Il codice sta in scripts/ritocca-titoli-demo.mjs.

clear
V="\033[0m"; G="\033[1;32m"; R="\033[1;31m"; Y="\033[1;33m"; B="\033[1m"; D="\033[2m"
ok(){ printf "${G}[OK] %s${V}\n" "$1"; }
ko(){ printf "${R}[NO] %s${V}\n" "$1"; }
nota(){ printf "${Y}[..] %s${V}\n" "$1"; }
info(){ printf "${D}     %s${V}\n" "$1"; }
stop(){
  echo
  printf "${R}${B}  ESITO: NON E ANDATA. Copia le righe rosse qui sopra a Claude.${V}\n"
  echo
  sleep 5; exit 1
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

PROGETTO="$HOME/Developer/journal-me"
REFERTI="$HOME/Documents/Claude/Projects/03 Journal.me"
PROFILO="$HOME/.dayalogue-demo-chrome"

printf "${B}dayalogue - titoli dell'account demo${V}\n\n"

# ---------- 1. attrezzi ----------
command -v node >/dev/null 2>&1 || { ko "Manca node. Installa Node.js e riprova."; stop; }
ok "Node $(node -v)"
[ -d "/Applications/Google Chrome.app" ] || { ko "Non trovo Google Chrome in /Applications: serve per far girare l'app."; stop; }
ok "Google Chrome"
[ -d "$REFERTI" ] || mkdir -p "$REFERTI"

# ---------- 2. il codice piu recente (clone a parte: non tocca ~/Developer/journal-me) ----------
if [ -d "$PROGETTO/.git" ]; then
  cd "$PROGETTO"
  con_tetto 120 git pull --ff-only origin main >/tmp/jm-demo-pull.log 2>&1 || { ko "Il pull non e riuscito:"; tail -6 /tmp/jm-demo-pull.log; stop; }
else
  info "scarico il codice in $PROGETTO..."
  con_tetto 300 git clone --depth 1 https://github.com/manuelvisuals/journal-me "$PROGETTO" >/tmp/jm-demo-clone.log 2>&1 || { ko "Non riesco a scaricare il codice da GitHub:"; tail -6 /tmp/jm-demo-clone.log; stop; }
  cd "$PROGETTO"
fi
ok "Codice aggiornato ($(git rev-parse --short HEAD))"
[ -f scripts/ritocca-titoli-demo.mjs ] || { ko "Manca scripts/ritocca-titoli-demo.mjs: il codice non e quello giusto."; stop; }

# ---------- 3. playwright-core (solo la libreria: usa il Chrome che hai) ----------
if [ ! -d node_modules/playwright-core ]; then
  info "scarico playwright-core (una volta sola)..."
  con_tetto 300 npm install --no-save --no-audit --no-fund playwright-core@1.63.0 >/tmp/jm-demo-npm.log 2>&1 || { ko "npm non e riuscito a scaricare playwright-core:"; tail -6 /tmp/jm-demo-npm.log; stop; }
fi
ok "playwright-core"

# ---------- 4. si va ----------
echo
nota "Adesso si apre la finestra di Chrome dell'account demo: NON toccarla finche non finisce (due minuti)."
echo
export JM_BASE="https://dayalogue.com"
export JM_DEMO_TITOLI="$PROGETTO/demo/giulia-titoli-en.json"
export JM_DEMO_PROFILO="$PROFILO"
export JM_DEMO_REFERTO="$REFERTI/referto-titoli-demo.html"
[ -f "$JM_DEMO_TITOLI" ] || { ko "Manca demo/giulia-titoli-en.json: il codice non e quello giusto."; stop; }
node scripts/ritocca-titoli-demo.mjs
ESITO=$?
echo
if [ "$ESITO" -eq 0 ]; then
  ok "Finito. Il referto e in: $JM_DEMO_REFERTO"
  open "$JM_DEMO_REFERTO" 2>/dev/null
  printf "${G}${B}  ESITO: FATTO. I titoli sono a posto; il referto si e aperto da solo.${V}\n"
else
  ko "Qualcosa non e andato. Il referto dice cosa: $JM_DEMO_REFERTO"
  open "$JM_DEMO_REFERTO" 2>/dev/null
  stop
fi
echo
sleep 3
