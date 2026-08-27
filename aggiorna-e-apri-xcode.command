#!/bin/bash
# dayalogue - aggiorna, ricostruisce il pacchetto dell'app e apre Xcode.
# Doppio clic, oppure incolla il contenuto nel Terminale.

clear
V="\033[0m"; G="\033[1;32m"; R="\033[1;31m"; Y="\033[1;33m"; B="\033[1m"; D="\033[2m"
ok(){ printf "${G}[OK] %s${V}\n" "$1"; }
ko(){ printf "${R}[NO] %s${V}\n" "$1"; }
wr(){ printf "${Y}[!!] %s${V}\n" "$1"; }
info(){ printf "${D}     %s${V}\n" "$1"; }
stop(){ echo; read -n 1 -s -r -p "Premi un tasto per chiudere."; echo; exit 1; }

printf "${B}dayalogue - aggiorna, ricostruisci, apri Xcode${V}\n\n"

# ---------- 1. la cartella giusta ----------
REPO=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO" ]; then
  for P in "$HOME/journal-me" "$HOME/Documents/journal-me" "$HOME/Desktop/journal-me" \
           "$HOME/Developer/journal-me" "$HOME/Projects/journal-me"; do
    [ -d "$P/.git" ] && REPO="$P" && break
  done
fi
if [ -z "$REPO" ]; then
  info "cerco la cartella del progetto..."
  F=$(find "$HOME" -maxdepth 6 -type d -name ".git" -path "*journal-me*" 2>/dev/null | head -1)
  [ -n "$F" ] && REPO=$(dirname "$F")
fi
if [ -z "$REPO" ] || [ ! -d "$REPO/.git" ]; then
  ko "Non trovo la cartella del progetto journal-me."
  stop
fi
cd "$REPO" || stop
ok "Progetto: $REPO"

# ---------- 2. attrezzi ----------
command -v node >/dev/null 2>&1 || { ko "Manca node. Installa Node.js e riprova."; stop; }
command -v npx  >/dev/null 2>&1 || { ko "Manca npx. Installa Node.js e riprova."; stop; }
ok "Node $(node -v)"

# ---------- 3. aggiorno il codice (rebase) ----------
git fetch origin >/dev/null 2>&1 || { ko "GitHub non raggiungibile. Controlla la rete (e che la VPN non sia di mezzo)."; stop; }
ok "GitHub raggiunto"

PRIMA=$(git rev-parse --short HEAD)
git checkout main >/dev/null 2>&1
if git -c rebase.autoStash=true pull --rebase origin main >/tmp/jm-pull.log 2>&1; then
  DOPO=$(git rev-parse --short HEAD)
  if [ "$PRIMA" = "$DOPO" ]; then ok "Codice gia aggiornato ($DOPO)"; else ok "Codice aggiornato: $PRIMA -> $DOPO"; fi
  info "$(git log -1 --pretty='%s')"
else
  ko "Il rebase non e riuscito. Copia queste righe a Claude:"
  tail -12 /tmp/jm-pull.log
  stop
fi

# ---------- 4. dipendenze ----------
if [ ! -d node_modules ]; then
  wr "Manca node_modules: installo (ci vuole qualche minuto)..."
  npm install --no-audit --no-fund >/tmp/jm-npm.log 2>&1 \
    && ok "Dipendenze installate" \
    || { ko "npm install fallito. Ultime righe:"; tail -12 /tmp/jm-npm.log; stop; }
else
  ok "Dipendenze presenti"
fi

# ---------- 5. ricostruisco il pacchetto dell'app ----------
SHA=$(git rev-parse --short HEAD)
DATA=$(date "+%d/%m %H:%M")
export NEXT_PUBLIC_BUILD="$SHA $DATA"
export NEXT_PUBLIC_SUPABASE_URL="https://fljshsmpmpzapcczsbwc.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PG0EigYjq38S0DY97VOKRA_i2u3Pqnm"
export NEXT_PUBLIC_API_BASE="https://journal-me-weld.vercel.app"
printf "     ricostruisco il pacchetto (%s)...\n" "$NEXT_PUBLIC_BUILD"
if JM_MOBILE=1 npx next build >/tmp/jm-build.log 2>&1; then
  ok "Pacchetto costruito"
else
  ko "La costruzione e fallita. Ultime righe:"; tail -20 /tmp/jm-build.log; stop
fi
if npx cap sync ios >/tmp/jm-sync.log 2>&1; then
  ok "Pacchetto copiato dentro l'app"
else
  ko "La copia dentro l'app e fallita. Ultime righe:"; tail -12 /tmp/jm-sync.log; stop
fi

# ---------- 6. controllo che dentro ci sia davvero la roba nuova ----------
BUNDLE="ios/App/App/public/_next/static"
grep -rql "$SHA" "$BUNDLE" 2>/dev/null \
  && ok "Dentro l'app c'e il commit $SHA (lo ritrovi in Impostazioni > Pacchetto)" \
  || wr "Non trovo il commit dentro il pacchetto: qualcosa non torna, dillo a Claude"
grep -rql "jm-benv-ling" "$BUNDLE" 2>/dev/null \
  && ok "C'e il saluto all'avvio con la linguetta" \
  || wr "Manca il saluto all'avvio: dillo a Claude"
grep -rql "jm-mese-mini" "$BUNDLE" 2>/dev/null \
  && ok "C'e il Mese a griglia" \
  || wr "Manca il Mese a griglia: dillo a Claude"

# ---------- 7. Xcode ----------
if [ -d "ios/App/App.xcodeproj" ]; then
  open "ios/App/App.xcodeproj" && ok "Xcode si sta aprendo" || ko "Non riesco ad aprire Xcode"
else
  ko "Non trovo ios/App/App.xcodeproj"
fi

echo
printf "${B}Adesso su Xcode:${V}\n"
echo "  1. collega l'iPhone col cavo e sbloccalo"
echo "  2. scegli il telefono nella barra in alto"
echo "  3. premi Play e ASPETTA che l'app si apra da sola"
echo "     (se la apri tu dalla schermata home, stai aprendo quella vecchia)"
echo
printf "  Poi in app: ${B}Impostazioni > Pacchetto${V} deve dire ${B}%s${V}\n" "$NEXT_PUBLIC_BUILD"
echo
read -n 1 -s -r -p "Premi un tasto per chiudere questa finestra."
echo
