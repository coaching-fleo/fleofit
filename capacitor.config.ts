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
  }
};

export default config;