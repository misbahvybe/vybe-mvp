# Deploy Vybe (Expo) to Google Play

Follow these steps in order. Pushing to Git does **not** update the store—you ship new **AAB** builds through Play Console (or `eas submit`).

## 1. One-time: Google Play developer account

1. Open [Google Play Console](https://play.google.com/console) and create a **developer account**.
2. Pay the **one-time $25** registration fee.
3. Complete account verification if Google asks for it.

## 2. One-time: Expo & EAS

From the **`mobile`** folder:

```bash
npm install
npx expo login
npm install -g eas-cli
eas login
```

Link the project (already has `projectId` in `app.json`):

```bash
eas whoami
eas project:info
```

If prompted, confirm the Expo project matches your app.

## 3. Credentials (EAS manages signing)

On the first production Android build, EAS will ask to create or upload a **keystore**. Choose **Generate new keystore** and let EAS store it—this is the usual path for Play uploads.

## 4. Environment variables (EAS secrets)

Set secrets so production builds include keys **without** committing them to git:

```bash
# Optional: Geoapify (address text when pinning on map)
eas secret:create --scope project --name EXPO_PUBLIC_GEOAPIFY_API_KEY --value YOUR_KEY

# Recommended for Android release maps (react-native-maps / Google tiles)
eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value YOUR_ANDROID_MAPS_KEY
```

Create the Android Maps key in [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create **API key**, restrict it to **Maps SDK for Android** and your app’s package name `com.vybecode.vybemobile`.

Then use `app.config.js` (see repo) so that key is injected at build time, or add it under `android.config.googleMaps.apiKey` via config.

## 5. Bump version when you ship meaningful releases

In **`app.json`**, update **`expo.version`** (e.g. `1.0.1`) for user-visible version strings.

**`versionCode`** is auto-incremented on each production Android build when using `eas.json` (`autoIncrement` + remote app version source).

## 6. Build the Android App Bundle (AAB)

Play requires **AAB** for new listings (not APK).

```bash
cd mobile
npm run eas:build:android
```

Or:

```bash
eas build --platform android --profile production
```

Wait for the build on [expo.dev](https://expo.dev) (free tier has monthly minute limits). Download the **.aab** if you upload manually.

## 7. Create the app in Play Console

1. **Create app** → default language, app name **Vybe**, type **App**.
2. Complete **Dashboard** tasks: privacy policy URL (required if you collect data), app access, ads declaration, content rating questionnaire, target audience, news app declaration, COVID contact declaration, **Data safety** form.
3. **Store listing**: short/full description, screenshots (phone required), feature graphic, icon (512×512).

## 8. Upload the release

**Option A – EAS Submit (recommended after first manual setup)**

1. In Play Console → **Setup** → **API access**, link a Google Cloud project and create a **service account** with permission to release on Play. Download the JSON key.
2. Locally:

   ```bash
   eas submit --platform android --profile production --latest
   ```

   First time, EAS will ask for the service account JSON path.

**Option B – Manual**

1. Play Console → **Release** → **Production** → **Create new release**.
2. Upload the `.aab` from step 6.
3. Set release name, review, **Roll out**.

## 9. Internal testing first (strongly recommended)

Use **Internal testing** track with a few Gmail testers before **Production**. Same AAB can be promoted after you’re happy.

## 10. After launch: updates

1. Change code, bump `expo.version` in `app.json` if you want.
2. Run `npm run eas:build:android` again.
3. Submit the new AAB (`eas submit --latest` or Play Console).

Optional: [EAS Update](https://docs.expo.dev/eas-update/introduction/) for JavaScript-only fixes without a full store release (native changes still need a new build).

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| Blank map on Android release | `GOOGLE_MAPS_ANDROID_API_KEY` + Maps SDK for Android enabled, package `com.vybecode.vybemobile` |
| Build fails on credentials | Run `eas credentials` and select Android → production |
| Play rejects AAB | Use **production** profile (AAB). APK-only profile is for sideloading (`preview`). |

## Quick reference

| Command | Purpose |
|---------|---------|
| `npm run eas:build:android` | Cloud AAB build |
| `npm run eas:submit:android` | Submit latest AAB to Play |
| `eas build --platform android --profile preview` | APK for testers (not for Play listing) |
