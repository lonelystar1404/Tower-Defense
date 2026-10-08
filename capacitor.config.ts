import type { CapacitorConfig } from '@capacitor/cli';

/** iOS app shell around the web build in dist/ (npm run ios:sync, then open ios/App in Xcode). */
const config: CapacitorConfig = {
  appId: 'com.thiennguyen.neonwardens',
  appName: 'Neon Wardens',
  webDir: 'dist',
  backgroundColor: '#05060b',
  ios: {
    // The page handles the notch itself (viewport-fit=cover + safe-area padding in style.css).
    contentInset: 'never',
    // A game screen: no rubber-band scrolling of the whole page.
    scrollEnabled: false,
    backgroundColor: '#05060b',
  },
};

export default config;
