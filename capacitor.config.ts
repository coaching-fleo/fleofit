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
      resize: 'none'
    }
  },
  server: {
    //url: 'http://192.168.1.20:5173', // Sostituisci con il tuo IP e porta di Vite
    cleartext: true
  }
};

export default config;