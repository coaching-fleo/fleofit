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

# 7. Sign in with Apple — il rilievo 4.8 del 02/09/2026 (CLAUDE.md §9-sexvicies).
#    Va verificato QUI e non nel sorgente: `App.entitlements` è lo stesso file per
#    Debug e Release, ma la capability va abilitata sull'App ID su Apple Developer,
#    e se è stata messa solo su `it.federicoleo.fleofit.dev` l'entitlement non
#    sopravvive alla rifirma di distribuzione. Il bottone resterebbe in pagina e
#    il login fallirebbe SOLO in produzione — cioè al revisore, e a nessun altro.
if print -r -- "$ENT" | grep -q "com.apple.developer.applesignin"; then
  echo "✅ Sign in with Apple: entitlement presente"
else
  echo "❌ Sign in with Apple: entitlement ASSENTE = di nuovo il rilievo 4.8"
fi

# 8. Il ponte JS del plugin sta nel bundle anche quando il nativo NON è compilato
#    (§9-sexvicies): il conflitto SPM lo lascia passare in silenzio. Qui si guarda
#    il binario, che è l'unico posto dove la differenza si vede.
BIN="$APP/$(defaults read "$APP/Info.plist" CFBundleExecutable 2>/dev/null || basename "$APP" .app)"
if strings "$BIN" 2>/dev/null | grep -q "SignInWithApple"; then
  echo "✅ Sign in with Apple: codice nativo dentro il binario"
else
  echo "❌ Sign in with Apple: il plugin nativo NON è compilato (serve Clean Build Folder)"
fi

# 9. L'ambiente di prova (CLAUDE.md §9-quinvicies). Aggiunto il 09/09/2026,
#    dopo che il SEME è arrivato fino a una build in preparazione senza che
#    niente lo segnalasse: il controllo che esisteva cercava «AMBIENTE DI PROVA»,
#    che sta solo in supabaseDemo.js, e quel giorno passava — mentre demoSemi.js
#    era dentro, con gli atleti finti e i loro allenamenti.
#    ⚠️ Si cercano TUTTE E TRE le tracce, non una: il finto client, il seme e la
#    chiave di localStorage escono dal bundle in momenti diversi, e ognuna da
#    sola è una mezza verità.
RESIDUI=0
for traccia in "AMBIENTE DI PROVA" "at-sara" "fleofit_demo_db"; do
  if grep -rqs -- "$traccia" "$APP" 2>/dev/null; then
    echo "❌ ambiente di prova nel binario: «$traccia»"
    RESIDUI=$((RESIDUI + 1))
  fi
done
[[ $RESIDUI -eq 0 ]] && echo "✅ nessuna traccia dell'ambiente di prova"

rm -rf "$TMP"
