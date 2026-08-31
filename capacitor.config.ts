import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.federicoleo.fleofit',
  appName: 'FLEOFIT',
  webDir: 'dist',
  bundledWebRuntime: false,

  // ─────────────────────────────────────────────────────────────────────────
  // ⚠️⚠️  LIVE RELOAD — DA CANCELLARE PRIMA DI OGNI ARCHIVE PER L'APP STORE
  // ─────────────────────────────────────────────────────────────────────────
  // Fa caricare l'app dal dev server invece che dal bundle copiato in
  // ios/App/App/public: si compila UNA volta da Xcode, poi ogni salvataggio
  // si vede sul telefono senza build né `cap sync`.
  //
  // Uso:  1) `npm run dev`   2) `npx cap sync ios`   3) Run da Xcode
  //       (Mac e iPhone sulla stessa rete Wi-Fi)
  //
  // 🔴 SE QUESTO BLOCCO FINISCE IN UN .ipa, L'APP SPEDITA PROVA A CARICARSI
  //    DAL MAC DI CASA E RESTA BIANCA. È esattamente il blocco `server` +
  //    `cleartext` rimosso nel commit fc81404 (CLAUDE.md §9-ter).
  //    Verifica prima dell'archive:
  //      grep -c "server" ios/App/App/capacitor.config.json   → deve dare 0
  //
  //    IP di questo Mac al 28/08/2026: 192.168.1.166 — cambia se cambia rete,
  //    ed è già cambiato una volta (era .18). Il sintomo quando è sbagliato è
  //    una schermata BIANCA sul telefono, senza nessun errore da nessuna parte:
  //    la webview sta aspettando un server che non risponde. Si rilegge con
  //      ipconfig getifaddr en0
  //    e dopo averlo cambiato serve `npx cap sync ios` — il valore finisce in
  //    ios/App/App/capacitor.config.json, che è la copia che Xcode compila.
  server: {
    url: 'http://192.168.1.166:5173',
    cleartext: true
  },
  // ────────────────────  FINE BLOCCO DA CANCELLARE  ────────────────────────

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