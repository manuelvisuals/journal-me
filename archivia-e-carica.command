#!/bin/bash
# dayalogue - archivia l'app dal Mac e la carica su App Store Connect
# SENZA toccare Xcode a mano: e il "Product > Archive" + "Distribute App >
# App Store Connect > Upload" fatto dalla riga di comando (xcodebuild), con
# la firma automatica e l'account Apple gia dentro Xcode.
#
# Perche esiste (12 settembre 2026): Manuel era lontano dal Mac e Claude
# poteva solo avviare uno script, non cliccare dentro Xcode. Da allora e la
# strada normale: un doppio clic, un caffe, la build compare in TestFlight.
#
# Prima: aggiorna-e-apri-xcode.command (ricostruisce il pacchetto web dentro
# l'app). Questo script NON lo rifa: archivia cio che c'e.
#
# Uso: doppio clic, oppure
#   clear; bash "$HOME/Developer/journal-me/archivia-e-carica.command"

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

REPO="$HOME/Developer/journal-me"
PROGETTO="$REPO/ios/App/App.xcodeproj"
SCHEMA="App"
TEAM="YQC5C496D3"
QUANDO=$(date +%Y%m%d-%H%M)
ARCHIVIO="$HOME/Library/Developer/Xcode/Archives/dayalogue-$QUANDO.xcarchive"
ESPORTO="/tmp/dayalogue-export-$QUANDO"
LOG="$HOME/Desktop/archivia-e-carica-log.txt"
: > "$LOG"

printf "${B}dayalogue - archivio e carico su App Store Connect${V}\n\n"

[ -d "$PROGETTO" ] || { ko "non trovo il progetto Xcode in $PROGETTO"; stop; }
cd "$REPO" || { ko "non riesco a entrare in $REPO"; stop; }
COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
ok "progetto: $PROGETTO (codice $COMMIT)"

# Il pacchetto web dentro l'app deve essere quello del codice attuale:
# aggiorna-e-apri-xcode.command lo scrive con dentro il commit.
if [ -d "ios/App/App/public" ]; then
  ok "pacchetto web presente dentro l'app"
else
  ko "manca ios/App/App/public: lancia prima aggiorna-e-apri-xcode.command"; stop
fi

VER=$(grep -m1 "MARKETING_VERSION" "$PROGETTO/project.pbxproj" | sed 's/.*= *//; s/;//')
BUILD=$(grep -m1 "CURRENT_PROJECT_VERSION" "$PROGETTO/project.pbxproj" | sed 's/.*= *//; s/;//')
ok "versione $VER, build $BUILD"

xcode-select -p >/dev/null 2>&1 || { ko "Xcode non e installato o non e selezionato (xcode-select)"; stop; }

# ---------- 1. Archive ----------
info "1/3 archivio (Any iOS Device, Release, firma automatica): 3-8 minuti..."
xcodebuild -project "$PROGETTO" -scheme "$SCHEMA" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVIO" \
  -allowProvisioningUpdates archive >>"$LOG" 2>&1
if [ $? -ne 0 ]; then
  ko "l'archivio non e riuscito. Ultime righe del registro:"
  grep -E "error:|FAILED|fatal" "$LOG" | tail -12
  stop
fi
[ -d "$ARCHIVIO" ] || { ko "xcodebuild ha finito ma l'archivio non c'e"; stop; }
ok "archivio creato: $ARCHIVIO"

# ---------- 2. Export + Upload ----------
mkdir -p "$ESPORTO"
cat > "$ESPORTO/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>$TEAM</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST
info "2/3 esporto e carico su App Store Connect (usa l'account Apple di Xcode): 2-6 minuti..."
xcodebuild -exportArchive -archivePath "$ARCHIVIO" \
  -exportOptionsPlist "$ESPORTO/ExportOptions.plist" -exportPath "$ESPORTO" \
  -allowProvisioningUpdates >>"$LOG" 2>&1
if [ $? -ne 0 ]; then
  ko "il caricamento non e riuscito. Ultime righe del registro:"
  grep -E "error:|Error|FAILED|fatal|ITMS" "$LOG" | tail -12
  info "L'archivio resta in $ARCHIVIO: si puo caricare anche da Xcode > Window > Organizer."
  stop
fi
ok "caricata su App Store Connect (versione $VER, build $BUILD)"

# ---------- 3. cosa succede adesso ----------
echo
if [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  CARICATA. Apple la elabora in 5-15 minuti, poi compare in App Store Connect > TestFlight.${V}\n"
  printf "${G}${B}  Prossimo passo: dillo a Claude (\"caricata\"), che la aggancia alla versione e ti mette su TestFlight.${V}\n\n"
else
  printf "${R}${B}  ESITO: %s PROBLEMA/I${V}\n\n" "$PROBLEMI"
fi
info "registro completo: $LOG"
echo
read -n 1 -s -r -p "Premi un tasto per chiudere."; echo
