import * as ImagePicker from 'expo-image-picker';

export async function pickGalleryImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }
  return result.assets[0].uri;
}
