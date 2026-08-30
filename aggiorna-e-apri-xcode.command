#!/bin/bash
# dayalogue - aggiorna, ricostruisce il pacchetto dell'app e apre Xcode.
# Doppio clic, oppure incolla il contenuto nel Terminale.

clear
V="\033[0m"; G="\033[1;32m"; R="\033[1;31m"; Y="\033[1;33m"; B="\033[1m"; D="\033[2m"
# Il conto dei guai. Un [NO] ferma tutto e si vede; un [!!] no — e proprio
# per quello alla fine serve un verdetto solo, invece di dover rileggere
# venti righe per capire se e andata bene.
PROBLEMI=0
ok(){ printf "${G}[OK] %s${V}\n" "$1"; }
ko(){ PROBLEMI=$((PROBLEMI+1)); printf "${R}[NO] %s${V}\n" "$1"; }
wr(){ PROBLEMI=$((PROBLEMI+1)); printf "${Y}[!!] %s${V}\n" "$1"; }
# Giallo ma NON un guaio: cose che vale la pena dirti e che non rompono
# niente (tipo "hai delle modifiche tue non salvate").
nota(){ printf "${Y}[..] %s${V}\n" "$1"; }
info(){ printf "${D}     %s${V}\n" "$1"; }
stop(){
  echo
  printf "${R}${B}  ESITO: NON E ANDATA. Copia le righe rosse qui sopra a Claude.${V}\n"
  echo
  read -n 1 -s -r -p "Premi un tasto per chiudere."; echo; exit 1
}

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
# Il pacchetto dentro ios/ e generato ma versionato: ricostruirlo qui sporca
# file che il pull vuole aggiornare, e al giro dopo il rebase si pianta con
# "Pulling is not possible because you have unmerged files". Si butta PRIMA
# di tirare, tanto lo rifacciamo trenta secondi dopo. E se un rebase e
# rimasto a meta da un tentativo precedente, si abortisce: se no resta
# bloccato per sempre.
git rebase --abort >/dev/null 2>&1
git merge --abort >/dev/null 2>&1
# Si toglie il conflitto dall'indice PRIMA: su file non uniti git checkout si
# rifiuta di lavorare, e senza questo passo si resta bloccati per sempre.
git reset -q >/dev/null 2>&1
# Si butta SOLO la parte generata. project.pbxproj sta anche lui dentro ios/
# ma lo scrive Xcode quando cambi le impostazioni: quello non si tocca.
git checkout -- ios/App/App/public >/dev/null 2>&1
git clean -fdq ios/App/App/public >/dev/null 2>&1
# package-lock.json e versionato, ma su questo Mac lo riscrive npm install
# (versioni di npm diverse riordinano il file). Nessuno lo modifica a mano,
# quindi la copia buona e sempre quella di GitHub. Senza questa riga il pull
# si rifiuta di partire con "You have unstaged changes" — successo il 28
# agosto 2026 al primo tentativo di ricostruire il pacchetto.
git checkout -- package-lock.json >/dev/null 2>&1
SPORCO=$(git status --porcelain | grep -v "^?? " | head -10)
if [ -n "$SPORCO" ]; then
  nota "Ci sono modifiche non salvate fuori dal pacchetto generato:"
  printf "%s\n" "$SPORCO"
  info "le lascio stare e provo lo stesso a tirare"
fi
IO_PRIMA=$(shasum "$0" 2>/dev/null | cut -d" " -f1)
if git pull --rebase origin main >/tmp/jm-pull.log 2>&1; then
  # Questo script sta DENTRO il repo che ha appena tirato: se il pull lo ha
  # cambiato, bash starebbe leggendo le righe successive da un file diverso
  # da quello con cui e partito, e il comportamento diventa imprevedibile.
  # Si riparte da capo con la versione nuova; al secondo giro l'impronta
  # coincide e non si ricomincia all'infinito.
  IO_DOPO=$(shasum "$0" 2>/dev/null | cut -d" " -f1)
  if [ -n "$IO_PRIMA" ] && [ "$IO_PRIMA" != "$IO_DOPO" ]; then
    ok "Lo script si e aggiornato: riparto con la versione nuova"
    exec bash "$0"
  fi
  DOPO=$(git rev-parse --short HEAD)
  if [ "$PRIMA" = "$DOPO" ]; then ok "Codice gia aggiornato ($DOPO)"; else ok "Codice aggiornato: $PRIMA -> $DOPO"; fi
  info "$(git log -1 --pretty='%s')"
else
  ko "Il rebase non e riuscito. Copia queste righe a Claude:"
  tail -12 /tmp/jm-pull.log
  stop
fi

# ---------- 4. dipendenze ----------
# SEMPRE npm install, non solo se manca node_modules: il 27 agosto il build
# e rimasto appeso per sempre perche il pull aveva portato un Next nuovo,
# node_modules era vecchio, e npx chiedeva "Ok to proceed? (y)" dentro un
# log dove nessuno puo rispondere. Con il lockfile gia allineato npm install
# ci mette secondi; quando c'e roba nuova, la mette.
info "controllo le dipendenze (secondi se sono gia aggiornate)..."
npm install --no-audit --no-fund >/tmp/jm-npm.log 2>&1 \
  && ok "Dipendenze aggiornate" \
  || { ko "npm install fallito. Ultime righe:"; tail -12 /tmp/jm-npm.log; stop; }

# ---------- 5. ricostruisco il pacchetto dell'app ----------
SHA=$(git rev-parse --short HEAD)
DATA=$(date "+%d/%m %H:%M")
export NEXT_PUBLIC_BUILD="$SHA $DATA"
export NEXT_PUBLIC_SUPABASE_URL="https://fljshsmpmpzapcczsbwc.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PG0EigYjq38S0DY97VOKRA_i2u3Pqnm"
export NEXT_PUBLIC_API_BASE="https://journal-me-weld.vercel.app"
printf "     ricostruisco il pacchetto (%s)...\n" "$NEXT_PUBLIC_BUILD"
if JM_MOBILE=1 npx --no-install next build >/tmp/jm-build.log 2>&1; then
  ok "Pacchetto costruito"
else
  ko "La costruzione e fallita. Ultime righe:"; tail -20 /tmp/jm-build.log; stop
fi
if npx --no-install cap sync ios >/tmp/jm-sync.log 2>&1; then
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
# 28 agosto: la porta dell'account. Sono classi CSS, quindi finiscono nel
# pacchetto solo se il foglio di stile e stato ricostruito davvero: e il
# modo piu economico di accorgersi che il build ha usato roba vecchia.
grep -rql "jm-foto-mini" "$BUNDLE" 2>/dev/null \
  && ok "C'e la foto profilo" \
  || wr "Manca la foto profilo: dillo a Claude"
grep -rql "jm-nome-penna" "$BUNDLE" 2>/dev/null \
  && ok "C'e la pennina per cambiare il nome" \
  || wr "Manca la pennina del nome: dillo a Claude"
# 30 agosto: la barra in alto col pallino su ogni schermata.
grep -rql "jm-appbar" "$BUNDLE" 2>/dev/null \
  && ok "C'e la barra in alto (il pallino su ogni schermata)" \
  || wr "Manca la barra in alto: dillo a Claude"

# ---------- 7. Xcode ----------
if [ -d "ios/App/App.xcodeproj" ]; then
  open "ios/App/App.xcodeproj" && ok "Xcode si sta aprendo" || ko "Non riesco ad aprire Xcode"
else
  ko "Non trovo ios/App/App.xcodeproj"
fi

echo
# ---------- 8. il verdetto ----------
# Una riga sola, in fondo, per non dover rileggere tutto: o e andata, o no.
if [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  ESITO: TUTTO OK. Il pacchetto e pronto, Xcode e aperto.${V}\n"
else
  printf "${R}${B}  ESITO: %s PROBLEMA/I. Cerca le righe [NO] e [!!] qui sopra e copiale a Claude.${V}\n" "$PROBLEMI"
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
