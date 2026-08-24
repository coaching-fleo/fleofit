import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.federicoleo.fleofit',
  appName: 'FLEOFIT',
  webDir: 'dist',
  bundledWebRuntime: false,
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