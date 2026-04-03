/**
 * Injects Android Google Maps API key at build time (react-native-maps release builds).
 * EAS: eas secret:create --name GOOGLE_MAPS_ANDROID_API_KEY --value YOUR_KEY
 * @see PLAY_STORE.md
 */
module.exports = ({ config }) => {
  const mapsKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
    '';

  const android = { ...(config.expo?.android ?? {}) };
  if (mapsKey) {
    android.config = {
      ...(android.config ?? {}),
      googleMaps: { apiKey: mapsKey },
    };
  }

  return {
    ...config,
    expo: {
      ...config.expo,
      android,
    },
  };
};
