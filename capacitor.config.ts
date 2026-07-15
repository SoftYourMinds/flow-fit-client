import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maksimbarisov.flowfit',
  appName: 'Flow Fit',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#F5F5F5',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
      androidSplashResourceName: 'splash',
      layoutName: 'launch_screen',
      useDialog: true,
    },
  },
};

export default config;
