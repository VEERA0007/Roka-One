import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gensolar.pro',
  appName: 'GenSolar Pro',
  webDir: 'web/dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#064e3b',
      showSpinner: false
    }
  }
};

export default config;
