import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fleofit.app',
  appName: 'fleofit',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'http://192.168.1.18:5173', // Sostituisci con il tuo IP e porta di Vite
    cleartext: true
  }
};

export default config;