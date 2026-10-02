import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.federicoleo.fleofit',
  appName: 'FLEOFIT',
  webDir: 'dist',
  bundledWebRuntime: false,

  // ─────────────────────────────────────────────────────────────────────────
  // ⚠️⚠️  LIVE RELOAD — DA CANCELLARE PRIMA DI OGNI BUILD PER IL PLAY STORE
  // ─────────────────────────────────────────────────────────────────────────
  // Fa caricare l'app dal dev server invece che dal bundle copiato in
  // android/app/src/main/assets/public: si installa UNA volta, poi ogni
  // salvataggio si vede sull'emulatore senza build né `cap sync`.
  //
  // Uso:  1) `npm run dev`   2) `npx cap sync android`   3) `./gradlew installDebug`
  //       Sull'emulatore il PC è 10.0.2.2, non localhost; su un telefono vero
  //       serve l'IP del PC sulla stessa rete Wi-Fi.
  //
  // 🔴 SE QUESTO BLOCCO FINISCE IN UNA BUILD DI RILASCIO, L'APP PROVA A
  //    CARICARSI DAL PC DI CASA E RESTA BIANCA, senza nessun errore.
  //    Verifica prima di ogni build di rilascio:
  //      grep -c "server" android/app/src/main/assets/capacitor.config.json   → deve dare 0

  // server: {
  //   url: 'http://10.0.2.2:5173',
  //   cleartext: true
  // },
  // ────────────────────  FINE BLOCCO DA CANCELLARE  ────────────────────────

  // 🔴 Il fondo della webview PRIMA che carichi qualunque cosa. Senza, fra lo
  // schermo di lancio e l'app si vede un lampo bianco (misurato il 22/09/2026
  // sull'app iOS, ed è un comportamento della webview, non della piattaforma).
  // Va insieme allo `<style>` in linea dentro index.html: questo copre la
  // webview, quello il documento.
  android: {
    backgroundColor: '#0B0B0B'
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true
    },
    Keyboard: {
      // 'native' fa rimpicciolire la webview quando la tastiera sale: senza,
      // i campi dentro le modali centrate finiscono sotto la tastiera e non
      // sono più raggiungibili (ExercisePicker, form atleta, note).
      resize: 'native'
    }
  }
};

export default config;