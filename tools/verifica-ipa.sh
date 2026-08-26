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
echo "ℹ️  versione: $VER ($BLD)"
echo "   Xcode rinumera da solo: con method app-store-connect,"
echo "   manageAppVersionAndBuildNumber vale YES per impostazione predefinita e"
echo "   il build number viene alzato oltre l'ultimo presente su App Store Connect."
echo "   Quindi il numero nel pbxproj NON è quello spedito. Verificato il 26/08/2026:"
echo "   pbxproj = 3, archivio = 2, ipa esportato = 4."

# 5. BACKLOG punto 2 — è il controllo mancato a maggio, quello del rifiuto 2.3.1(a).
#    ⚠️ In un'app Capacitor il bundle web sta in App.app/public/assets, NON nella
#    radice del .app. La prima versione di questo script cercava nel posto
#    sbagliato e dava un falso negativo (26/08/2026): cerca ricorsivamente.
#    Si controllano TUTTE le email, non solo demo: se ADMIN_EMAILS non è finita
#    nel bundle compilato, il ruolo coach è irraggiungibile per chiunque.
MANCANTI=0
for MAIL in coaching@federicoleo.it alessandro.patrone@hotmail.it \
            federico_leo@hotmail.it federico.leo88@gmail.com demo@fleofit.it; do
  if grep -rqs -- "$MAIL" "$APP"; then
    echo "✅ $MAIL nel bundle"
  else
    echo "❌ $MAIL ASSENTE dal bundle"
    MANCANTI=$((MANCANTI + 1))
  fi
done
[[ $MANCANTI -gt 0 ]] && echo "   ⚠️ demo@fleofit.it assente = rifiuto 2.3.1(a), è successo a maggio"

# 6. Residui che avevano insospettito lo scanner di Apple.
for parola in cloud-sync "Modalità Bunker" cleartext; do
  if grep -rqs "$parola" "$APP" 2>/dev/null; then echo "❌ trovato residuo: $parola"
  else echo "✅ nessun residuo: $parola"; fi
done

rm -rf "$TMP"
