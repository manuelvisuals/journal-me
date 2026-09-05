#!/bin/bash
# dayalogue - costruisce l'app CON I FILE CHE HAI ADESSO NELLA CARTELLA e apre
# Xcode, per vedere i temi nuovi sul telefono senza passare da GitHub.
#
# In cosa e diverso da aggiorna-e-apri-xcode.command: quello va a prendere
# main da GitHub e ci si allinea sopra. Questo NON tocca git: ne fetch, ne
# checkout, ne pull. Costruisce esattamente cio che e scritto sul disco in
# questo momento, ramo compreso. E il modo giusto di provare un lavoro che
# esiste solo qui e non e ancora su GitHub - come i nove temi del 5 settembre.
#
# Quando i temi saranno uniti in main, torna a usare l'altro script.

clear
V="\033[0m"; G="\033[1;32m"; R="\033[1;31m"; Y="\033[1;33m"; B="\033[1m"; D="\033[2m"
PROBLEMI=0
ok(){ printf "${G}[OK] %s${V}\n" "$1"; }
ko(){ PROBLEMI=$((PROBLEMI+1)); printf "${R}[NO] %s${V}\n" "$1"; }
nota(){ printf "${Y}[..] %s${V}\n" "$1"; }
info(){ printf "${D}     %s${V}\n" "$1"; }
stop(){
  echo
  printf "${R}${B}  ESITO: NON E ANDATA. Copia le righe rosse qui sopra a Claude.${V}\n"
  echo
  read -n 1 -s -r -p "Premi un tasto per chiudere."; echo; exit 1
}

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

printf "${B}dayalogue - i temi nuovi sul telefono, senza passare da GitHub${V}\n\n"

# ---------- 1. la cartella ----------
[ -d "$REPO/.git" ] || { ko "non trovo il repo in $REPO"; stop; }
cd "$REPO" || { ko "non riesco a entrare in $REPO"; stop; }
ok "cartella: $REPO"

command -v node >/dev/null 2>&1 || { ko "manca node"; stop; }
command -v npx  >/dev/null 2>&1 || { ko "manca npx"; stop; }
ok "Node $(node -v)"

# ---------- 2. i temi ci sono davvero in questa cartella? ----------
# Se qualcuno ha cambiato ramo nel frattempo, meglio saperlo PRIMA di
# aspettare quindici minuti di build per poi non vedere ninete di nuovo.
if [ ! -f "src/themes/ardesia.ts" ] || ! grep -q "catppuccin" src/themes/index.ts; then
  ko "in questa cartella i nove temi non ci sono (manca ardesia.ts o non sono registrati)"
  info "sei su un altro ramo? I temi stanno su temi-regalo-schede."
  stop
fi
ok "i nove temi ci sono e sono registrati"

# ---------- 3. il pacchetto ----------
# Niente git fetch, niente checkout: si costruisce cio che c'e.
SHA=$(git rev-parse --short HEAD 2>/dev/null)
DATA=$(date "+%d/%m %H:%M")
export NEXT_PUBLIC_BUILD="$SHA+temi $DATA"
export NEXT_PUBLIC_SUPABASE_URL="https://fljshsmpmpzapcczsbwc.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PG0EigYjq38S0DY97VOKRA_i2u3Pqnm"
export NEXT_PUBLIC_API_BASE="https://journal-me-weld.vercel.app"

echo
printf "     ricostruisco il pacchetto (%s), un paio di minuti...\n" "$NEXT_PUBLIC_BUILD"
export JM_MOBILE=1
con_tetto 900 npx --no-install next build >/tmp/jm-build.log 2>&1
ESITO=$?
unset JM_MOBILE
if [ "$ESITO" -eq 0 ]; then
  ok "pacchetto costruito"
elif [ "$ESITO" -eq 124 ]; then
  ko "la costruzione non e finita in quindici minuti: mi fermo. Ultime righe:"
  tail -20 /tmp/jm-build.log
  stop
else
  ko "la costruzione e fallita. Ultime righe:"
  tail -20 /tmp/jm-build.log
  stop
fi

# La radice del pacchetto: senza questa riga cap sync si rifiuta
# ("must contain an index.html"), perche la radice del dominio e il sito.
if node scripts/ios-radice.mjs >/tmp/jm-radice.log 2>&1; then
  ok "radice del pacchetto scritta"
else
  ko "scripts/ios-radice.mjs fallito. Ultime righe:"
  tail -12 /tmp/jm-radice.log
  stop
fi

if con_tetto 300 npx --no-install cap sync ios >/tmp/jm-sync.log 2>&1; then
  ok "pacchetto copiato dentro il progetto iOS"
else
  ko "cap sync ios fallito. Ultime righe:"
  tail -15 /tmp/jm-sync.log
  stop
fi

# ---------- 4. Xcode ----------
if [ -d "ios/App/App.xcodeproj" ]; then
  open "ios/App/App.xcodeproj" && ok "Xcode si sta aprendo" || ko "non riesco ad aprire Xcode"
else
  ko "non trovo ios/App/App.xcodeproj"
fi

echo
if [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  ESITO: TUTTO OK. Il pacchetto e pronto, Xcode e aperto.${V}\n"
else
  printf "${R}${B}  ESITO: %s PROBLEMA/I. Copia le righe rosse a Claude.${V}\n" "$PROBLEMI"
fi

echo
printf "${B}Adesso su Xcode:${V}\n"
echo "  1. collega l'iPhone col cavo e sbloccalo"
echo "  2. scegli il telefono nella barra in alto"
echo "  3. premi Play e ASPETTA che l'app si apra da sola"
echo "     (se la apri tu dalla schermata home, stai aprendo quella vecchia)"
echo
printf "  Poi in app: ${B}Impostazioni > Pacchetto${V} deve dire ${B}%s${V}\n" "$NEXT_PUBLIC_BUILD"
printf "  e ${B}Impostazioni > Tema${V} deve mostrare ${B}quattordici temi${V},\n"
echo "  nell'ordine: Minimal, Macchina, Malva, Korall ardesia, Korall,"
echo "  Carta, Gruvbox, Wine, Grafit, Nord, Ocean, Tokyo Night,"
echo "  Ametista, Catppuccin."
echo
read -n 1 -s -r -p "Premi un tasto per chiudere questa finestra."
echo
