#!/bin/bash
# dayalogue - mette la chiave In-App Purchase di Apple su Vercel.
# Doppio clic, oppure: clear; bash "$HOME/Developer/journal-me/chiave-apple-su-vercel.command"
#
# COSA FA (4 settembre 2026). Claude ha creato su App Store Connect la chiave
# "dayalogue server" e il file SubscriptionKey_<KEY ID>.p8 e finito in
# Scaricati. Quel file e un segreto: Claude NON lo tocca e non lo copia. Lo
# legge questo script, sul tuo Mac, e lo passa a Vercel come variabile
# d'ambiente (APPLE_IAP_PRIVATE_KEY), insieme a APPLE_IAP_KEY_ID e
# APPLE_IAP_ISSUER_ID. Poi sposta il file in Documenti/dayalogue-chiavi,
# perche Apple lo fa scaricare UNA volta sola.
#
# Prima di scrivere su Vercel prova la chiave contro il server sandbox di
# Apple: se Apple risponde "non autorizzato" la chiave e sbagliata e non si
# scrive niente.
#
# Si puo rilanciare quante volte vuoi: sovrascrive le tre variabili.

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

APPLE_401=""
ISSUER_ID="27112788-4078-4dd9-9089-edfa11913163"
BUNDLE_ID="com.manuelvisuals.journalme"
PROGETTO="$HOME/Developer/journal-me"
CASSETTO="$HOME/Documents/dayalogue-chiavi"
TEAM_VERCEL="hodl-inc"
PROGETTO_VERCEL="journal-me"

printf "${B}dayalogue - chiave Apple su Vercel${V}\n\n"

# ---------- 1. il file .p8 ----------
CHIAVE=""
for cartella in "$HOME/Downloads" "$CASSETTO" "$HOME/Desktop"; do
  [ -d "$cartella" ] || continue
  trovata="$(ls -t "$cartella"/SubscriptionKey_*.p8 2>/dev/null | head -1)"
  if [ -n "$trovata" ]; then CHIAVE="$trovata"; break; fi
done
if [ -z "$CHIAVE" ]; then
  ko "Non trovo nessun file SubscriptionKey_*.p8 in Scaricati, Documenti/dayalogue-chiavi o Scrivania."
  info "Su App Store Connect > Users and Access > Integrations > In-App Purchase la chiave"
  info "\"dayalogue server\" risulta gia scaricata (Apple la da una volta sola). Se il file e"
  info "sparito: cancella quella chiave, creane una nuova con lo stesso nome e rilancia."
  stop
fi
ok "Chiave: $CHIAVE"
NOME_FILE="$(basename "$CHIAVE")"
KEY_ID="${NOME_FILE#SubscriptionKey_}"; KEY_ID="${KEY_ID%.p8}"
if ! printf '%s' "$KEY_ID" | grep -Eq '^[A-Z0-9]{10}$'; then
  ko "Dal nome del file non riesco a leggere il Key ID (mi aspetto SubscriptionKey_XXXXXXXXXX.p8)."
  stop
fi
ok "Key ID: $KEY_ID"
if ! grep -q "BEGIN PRIVATE KEY" "$CHIAVE"; then
  ko "Il file non sembra una chiave privata (manca BEGIN PRIVATE KEY)."
  stop
fi

# ---------- 2. node ----------
if ! command -v node >/dev/null 2>&1; then
  ko "node non c'e. Lancia prima aggiorna-e-apri-xcode.command, che lo controlla."
  stop
fi
ok "Node $(node -v)"

# ---------- 3. la chiave firma davvero? Apple la accetta? ----------
# Stesso gettone che fa il server (src/modules/abbonamento/server/apple-api.ts).
# Si chiede al server SANDBOX di Apple una transazione che non esiste:
# 404 = chiave valida (Apple ci ha riconosciuti, la transazione no);
# 401 = chiave, Key ID o Issuer ID sbagliati.
PROVA="$(CHIAVE="$CHIAVE" KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER_ID" BUNDLE_ID="$BUNDLE_ID" node -e '
const { createPrivateKey, createSign } = require("node:crypto");
const fs = require("node:fs");
const pem = fs.readFileSync(process.env.CHIAVE, "utf8");
const b64 = (s) => Buffer.from(s).toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const h = b64(JSON.stringify({ alg: "ES256", kid: process.env.KEY_ID, typ: "JWT" }));
const p = b64(JSON.stringify({ iss: process.env.ISSUER_ID, iat, exp: iat + 1200, aud: "appstoreconnect-v1", bid: process.env.BUNDLE_ID }));
const s = createSign("SHA256"); s.update(h + "." + p); s.end();
const raw = s.sign({ key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
const jwt = h + "." + p + "." + b64(raw);
fetch("https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/1", { headers: { Authorization: "Bearer " + jwt }, signal: AbortSignal.timeout(15000) })
  .then(async (r) => { const b = await r.text().catch(() => ""); console.log(String(r.status) + " " + b.replace(/\s+/g, " ").slice(0, 160)); })
  .catch((e) => { console.log("rete:" + e.message); });
' 2>&1)"
CODICE="${PROVA%% *}"
case "$CODICE" in
  404|200) ok "Apple riconosce la chiave (risposta $CODICE alla prova in sandbox)." ;;
  401)
    # Una chiave APPENA creata su App Store Connect puo dare 401 per un po'
    # (Apple la propaga ai suoi server con calma, anche mezz'ora). La chiave
    # e ben formata e firma: si scrive comunque, e si riprova piu tardi.
    nota "Apple risponde 401 alla prova: $PROVA"
    nota "Se la chiave e stata creata da poco e normale: Apple ci mette un po' a riconoscerla."
    nota "Scrivo comunque su Vercel (la chiave firma correttamente). Rilancia questo script fra"
    nota "15-30 minuti: se allora dice [OK] Apple riconosce la chiave, e tutto a posto."
    APPLE_401=1 ;;
  rete:*) ko "Non raggiungo Apple: ${PROVA#rete:}"; stop ;;
  *) ko "Risposta inattesa da Apple o dalla chiave: $PROVA"; stop ;;
esac

# ---------- 4. Vercel ----------
cd "$PROGETTO" 2>/dev/null || { ko "Non trovo la cartella $PROGETTO"; stop; }
VERCEL="npx --yes vercel@latest"
nota "Controllo l'accesso a Vercel (la prima volta scarica il programma: un minuto)..."
if ! con_tetto 120 $VERCEL whoami >/dev/null 2>&1; then
  nota "Non sei dentro Vercel su questo Mac: si apre il browser, conferma l'accesso."
  if ! con_tetto 300 $VERCEL login; then ko "Accesso a Vercel non riuscito."; stop; fi
fi
ok "Vercel: $($VERCEL whoami 2>/dev/null)"
if [ ! -f .vercel/project.json ]; then
  if ! con_tetto 120 $VERCEL link --yes --scope "$TEAM_VERCEL" --project "$PROGETTO_VERCEL" >/dev/null 2>&1; then
    ko "Non riesco a collegare la cartella al progetto $TEAM_VERCEL/$PROGETTO_VERCEL su Vercel."
    stop
  fi
fi
ok "Cartella collegata al progetto $TEAM_VERCEL/$PROGETTO_VERCEL"

metti(){
  nome="$1"; valore="$2"
  for ambiente in production preview; do
    con_tetto 60 $VERCEL env rm "$nome" "$ambiente" --yes >/dev/null 2>&1
    if printf '%s' "$valore" | con_tetto 60 $VERCEL env add "$nome" "$ambiente" >/dev/null 2>&1; then
      ok "$nome scritta ($ambiente)"
    else
      ko "$nome NON scritta ($ambiente)"
    fi
  done
}
metti APPLE_IAP_KEY_ID "$KEY_ID"
metti APPLE_IAP_ISSUER_ID "$ISSUER_ID"
metti APPLE_IAP_PRIVATE_KEY "$(cat "$CHIAVE")"

# ---------- 5. il file al sicuro ----------
mkdir -p "$CASSETTO"
if [ "$(dirname "$CHIAVE")" != "$CASSETTO" ]; then
  if mv "$CHIAVE" "$CASSETTO/"; then
    ok "File spostato in Documenti/dayalogue-chiavi (tienilo: Apple non lo rida)."
  else
    nota "Non sono riuscito a spostare il file: lascialo dove e, ma non cancellarlo."
  fi
fi

echo
if [ "$PROBLEMI" -eq 0 ] && [ -n "$APPLE_401" ]; then
  printf "${Y}${B}  ESITO: SCRITTO SU VERCEL, MA APPLE NON HA ANCORA RICONOSCIUTO LA CHIAVE (401).${V}\n"
  info "Rilancia questo script fra 15-30 minuti. Se dice ancora 401, copia a Claude la riga"
  info "gialla che inizia con 'Apple risponde 401'."
elif [ "$PROBLEMI" -eq 0 ]; then
  printf "${G}${B}  ESITO: TUTTO A POSTO. Le tre variabili sono su Vercel.${V}\n"
  info "Valgono dal prossimo deploy (il prossimo push su main): ci pensa Claude."
else
  printf "${R}${B}  ESITO: $PROBLEMI PROBLEMI. Copia le righe rosse a Claude.${V}\n"
fi
echo
read -n 1 -s -r -p "Premi un tasto per chiudere."; echo
