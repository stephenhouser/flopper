# Development Notes

Expo Progressive web app -- to make "installable" on iOS and Android as an app on their home screen. Also works on desktop (I think)

<https://docs.expo.dev/guides/progressive-web-apps/>

## Icons

To enable proper icons (for settings gear and other places) in Expo apps:

```
expo install @expo/vector-icons
```

## Keyboard Hot-Keys

Because Expo Go can’t load arbitrary native modules, you’ll need a dev build:
Install the library:

```
npm i react-native-key-command
expo install @react-native-async-storage/async-storage
```

Prebuild & apply native changes, then build a dev client:

```
npm i react-native-key-command
npx expo prebuild
(cd ios && pod install)
# iOS: runs `pod install` automatically; ensure the AppDelegate additions from the README are applied
# Android: ensure the MainActivity.onKeyDown override is applied
eas build --profile development --platform all
```

The code I added dynamically requires the module and no-ops if it isn’t present, so your app keeps running in Expo Go until you switch to the dev build.
