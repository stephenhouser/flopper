# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## TODO

Progressive web app

<https://docs.expo.dev/guides/progressive-web-apps/>

Proper icons (for settings gear)

```
expo install @expo/vector-icons
```

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

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
