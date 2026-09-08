#!/bin/bash
# dayalogue - carica l'account demo per la revisione Apple (Giulia, agosto 2026).
# Doppio clic, oppure: clear; bash "$HOME/Developer/journal-me/carica-account-demo.command"
#
# COSA FA (8 settembre 2026). Apre una finestra di Chrome a parte (profilo
# suo, in ~/.dayalogue-demo-chrome, non tocca il tuo Chrome) e dentro fa
# quello che farebbe una persona: entra su dayalogue.com con l'email del
# revisore e il codice fisso, prende le otto parole della cassaforte, mette
# nome e foto, e poi scrive le ventotto giornate di agosto una per una,
# lasciando che l'AI vera le chiuda (titoli, sintesi, aree, fatti). Poi i
# memo e il recap di agosto. Il codice sta in scripts/carica-account-demo.mjs.
#
# DUE GIRI. L'AI vuole un account premium, e premium lo mette Claude con una
# SQL dopo che l'account esiste. Il primo giro si ferma da solo dopo nome e
# foto se il piano e ancora gratis; Claude fa la SQL; il secondo giro carica
# tutto. Se l'account e gia premium, fa tutto in un giro.
#
# NON toccare la finestra di Chrome mentre lavora (dieci minuti circa).
# Alla fine il referto e in Documenti/Claude/Projects/03 Journal.me/
# referto-account-demo.html: aprilo e mandalo a Claude.

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

PROGETTO="$HOME/Developer/journal-me"
REFERTI="$HOME/Documents/Claude/Projects/03 Journal.me"
PROFILO="$HOME/.dayalogue-demo-chrome"
EMAIL="appreview@dayalogue.com"
# Il codice fisso del revisore: lo stesso di JM_REVIEW_CODE su Vercel e di
# PIANO-APPSTORE.md (par. 1c). Se Claude lo cambia su Vercel, cambia anche qui.
CODICE="424242"

printf "${B}dayalogue - account demo per la revisione Apple${V}\n\n"

# ---------- 1. attrezzi ----------
cd "$PROGETTO" 2>/dev/null || { ko "Non trovo la cartella $PROGETTO"; stop; }
command -v node >/dev/null 2>&1 || { ko "Manca node. Installa Node.js e riprova."; stop; }
ok "Node $(node -v)"
[ -d "/Applications/Google Chrome.app" ] || { ko "Non trovo Google Chrome in /Applications: serve per far girare l'app."; stop; }
ok "Google Chrome"
[ -d "$REFERTI" ] || mkdir -p "$REFERTI"

# ---------- 2. il codice piu recente ----------
info "leggo GitHub..."
con_tetto 90 git fetch origin >/tmp/jm-demo-fetch.log 2>&1
ESITO=$?
if [ "$ESITO" -ne 0 ]; then
  ko "Non riesco a leggere GitHub. Git dice:"
  tail -6 /tmp/jm-demo-fetch.log
  stop
fi
if git status --porcelain | grep -q "^ M\|^M "; then
  nota "Ci sono modifiche locali nel repo: non tiro, uso il codice che c'e."
  nota "Se vuoi l'ultimo, lancia prima aggiorna-e-apri-xcode.command."
else
  con_tetto 120 git pull --rebase origin main >/tmp/jm-demo-pull.log 2>&1 || { ko "Il pull non e riuscito:"; tail -6 /tmp/jm-demo-pull.log; stop; }
  ok "Codice aggiornato ($(git rev-parse --short HEAD))"
fi
[ -f scripts/carica-account-demo.mjs ] || { ko "Manca scripts/carica-account-demo.mjs: il codice non e quello giusto."; stop; }
[ -f demo/giulia-en.json ] || { ko "Manca demo/giulia-en.json."; stop; }

# ---------- 3. playwright-core (solo la libreria: usa il Chrome che hai) ----------
if [ ! -d node_modules/playwright-core ]; then
  info "scarico playwright-core (una volta sola)..."
  con_tetto 300 npm install --no-save --no-audit --no-fund playwright-core@1.63.0 >/tmp/jm-demo-npm.log 2>&1 || { ko "npm non e riuscito a scaricare playwright-core:"; tail -6 /tmp/jm-demo-npm.log; stop; }
fi
ok "playwright-core"

# ---------- 4. si va ----------
echo
nota "Adesso si apre una finestra di Chrome: NON toccarla finche non finisce."
info "primo giro: accesso, cassaforte, nome, foto (un minuto)"
info "secondo giro (o subito, se l'account e gia premium): 28 giornate, memo, recap (dieci minuti)"
echo
export JM_BASE="https://dayalogue.com"
export JM_DEMO_EMAIL="$EMAIL"
export JM_DEMO_CODICE="$CODICE"
export JM_DEMO_DATI="$PROGETTO/demo/giulia-en.json"
export JM_DEMO_FOTO="$PROGETTO/demo/giulia-profilo.jpg"
export JM_DEMO_PROFILO="$PROFILO"
export JM_DEMO_REFERTO="$REFERTI/referto-account-demo.html"
node scripts/carica-account-demo.mjs
ESITO=$?
echo
if [ "$ESITO" -eq 0 ]; then
  ok "Finito. Il referto e in: $JM_DEMO_REFERTO"
  open "$JM_DEMO_REFERTO" 2>/dev/null
  printf "${G}${B}  ESITO: FATTO. Apri il referto (si e aperto da solo) e di' a Claude com'e andata.${V}\n"
else
  ko "Il caricamento si e interrotto. Il referto dice perche: $JM_DEMO_REFERTO"
  open "$JM_DEMO_REFERTO" 2>/dev/null
  stop
fi
echo
read -n 1 -s -r -p "Premi un tasto per chiudere."; echo
