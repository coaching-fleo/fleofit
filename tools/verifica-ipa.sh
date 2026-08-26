#!/bin/zsh
# Controlli pre-submission sul binario che verrà davvero spedito.
# Uso:  ./tools/verifica-ipa.sh <cartella-export>
# La cartella è quella prodotta da xcodebuild -exportArchive.
set -u
DIR="${1:?Passa la cartella dell'export}"
IPA=$(find "$DIR" -maxdepth 1 -name '*.ipa' | head -1)
[[ -z "$IPA" ]] && { echo "❌ Nessun .ipa in $DIR"; exit 1; }

TMP=$(mktemp -d)
unzip -q "$IPA" -d "$TMP"
APP=$(find "$TMP/Payload" -maxdepth 1 -name '*.app' | head -1)
[[ -z "$APP" ]] && { echo "❌ Nessun .app dentro l'ipa"; exit 1; }

echo "── ipa: $(basename "$IPA")"
echo

ENT=$(codesign -d --entitlements - --xml "$APP" 2>/dev/null | plutil -p - 2>/dev/null)
APS=$(print -r -- "$ENT" | sed -n 's/.*"aps-environment" => "\(.*\)".*/\1/p')
GTA=$(print -r -- "$ENT" | grep -c '"get-task-allow" => 1')

esito() { [[ "$2" == "$3" ]] && echo "✅ $1: $2" || echo "❌ $1: $2  (atteso: $3)"; }

# 1. BACKLOG punto 1 — senza production nessun utente riceve le push,
#    e te ne accorgi solo dopo la pubblicazione.
esito "aps-environment" "${APS:-ASSENTE}" "production"

# 2. get-task-allow deve essere assente in una build di distribuzione.
[[ "$GTA" == "0" ]] && echo "✅ get-task-allow: assente (build di distribuzione)" \
                    || echo "❌ get-task-allow presente: è una build di sviluppo"

# 3. Bundle id: quello di Release, non il .dev del Debug.
BID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist" 2>/dev/null)
esito "bundle id" "$BID" "it.federicoleo.fleofit"

# 4. Build number: deve essere MAGGIORE di quelli già bruciati su ASC.
VER=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist" 2>/dev/null)
BLD=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist" 2>/dev/null)
echo "ℹ️  versione: $VER ($BLD) — su ASC sono già usate la (2) e la (3): questa deve essere ≥ 4"

# 5. BACKLOG punto 2 — è il controllo mancato a maggio, quello del rifiuto 2.3.1(a).
if grep -lq "demo@fleofit.it" "$APP"/*.js "$APP"/assets/*.js 2>/dev/null; then
  echo "✅ demo@fleofit.it presente nel bundle JS"
else
  echo "❌ demo@fleofit.it ASSENTE dal bundle: è la causa del rifiuto di maggio"
fi

# 6. Residui che avevano insospettito lo scanner di Apple.
for parola in cloud-sync "Modalità Bunker" cleartext; do
  if grep -rqs "$parola" "$APP" 2>/dev/null; then echo "❌ trovato residuo: $parola"
  else echo "✅ nessun residuo: $parola"; fi
done

rm -rf "$TMP"
