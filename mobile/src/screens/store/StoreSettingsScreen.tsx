import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { api } from '@api/client';
import { uploadStoreOwnerImage } from '@api/uploads';
import { pickGalleryImage } from '@lib/pickGalleryImage';
import { useAuthStore } from '@store/auth';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

interface StoreInfo {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  phone?: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  isOpen: boolean;
  openingTime?: string;
  closingTime?: string;
}

export function StoreSettingsScreen() {
  const token = useAuthStore((s) => s.token);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    phone: '',
    address: '',
    city: 'Lahore',
    latitude: '',
    longitude: '',
    openingTime: '09:00',
    closingTime: '22:00',
    isOpen: true,
  });

  useEffect(() => {
    setLoading(true);
    api
      .get<StoreInfo>('/store-owner/store')
      .then((res) => {
        const s = res.data;
        setStore(s);
        if (s) {
          setForm({
            name: s.name,
            description: s.description ?? '',
            imageUrl: s.imageUrl ?? '',
            phone: s.phone ?? '',
            address: s.address ?? '',
            city: s.city ?? 'Lahore',
            latitude: s.latitude != null ? String(s.latitude) : '',
            longitude: s.longitude != null ? String(s.longitude) : '',
            openingTime: s.openingTime ?? '09:00',
            closingTime: s.closingTime ?? '22:00',
            isOpen: s.isOpen,
          });
        }
      })
      .catch(() => {
        setStore(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const pickStorePhoto = async () => {
    const uri = await pickGalleryImage();
    if (!uri) {
      Alert.alert('Photos', 'Photo access was denied or no image was selected.');
      return;
    }
    if (!token) {
      Alert.alert('Session', 'Please sign in again.');
      return;
    }
    setImageUploading(true);
    try {
      const imageUrl = await uploadStoreOwnerImage(uri, token);
      setForm((f) => ({ ...f, imageUrl }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      Alert.alert('Upload failed', msg);
    } finally {
      setImageUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/store-owner/store', {
        ...form,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      Alert.alert('Saved', 'Store settings updated.');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to save store';
      Alert.alert('Error', String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PartnerScreenShell title="Store settings" scrollable={false} bottomPadding="nav">
      {loading ? (
        <View style={[styles.body, styles.center]}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.switchTitle}>Store Open</Text>
              <TouchableOpacity
                onPress={() => setForm((f) => ({ ...f, isOpen: !f.isOpen }))}
                style={[
                  styles.toggle,
                  { backgroundColor: form.isOpen ? '#22c55e' : '#cbd5e1' },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    { transform: [{ translateX: form.isOpen ? 18 : 0 }] },
                  ]}
                />
              </TouchableOpacity>
            </View>
            <Text
              style={[
                styles.switchHint,
                { color: form.isOpen ? '#16a34a' : '#dc2626' },
              ]}
            >
              {form.isOpen
                ? 'Open – customers can order'
                : 'Closed – store hidden from listing'}
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label="Store name"
              placeholder="e.g. Karachi Biryani House"
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
            />
            <Text style={styles.fieldLabel}>Store photo (listing image)</Text>
            {form.imageUrl ? (
              <Image
                source={{ uri: form.imageUrl }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : null}
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={pickStorePhoto}
              disabled={imageUploading}
            >
              {imageUploading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.galleryButtonText}>Choose from gallery</Text>
              )}
            </TouchableOpacity>
            {form.imageUrl ? (
              <TouchableOpacity
                onPress={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                style={{ marginBottom: 8 }}
              >
                <Text style={styles.linkMuted}>Remove photo</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.helperText}>Or paste an image link</Text>
            <Field
              label=""
              placeholder="https://…"
              value={form.imageUrl}
              onChangeText={(t) => setForm((f) => ({ ...f, imageUrl: t }))}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="About your store (customers see this)"
              placeholder="e.g. Authentic biryani, karahi, and BBQ — fresh daily"
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              multiline
            />
            <Field
              label="Phone"
              value={form.phone}
              keyboardType="phone-pad"
              onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
            />
            <Field
              label="Address / Location"
              placeholder="e.g. DHA Phase 5, Lahore"
              value={form.address}
              onChangeText={(t) => setForm((f) => ({ ...f, address: t }))}
            />
            <Field
              label="City"
              placeholder="Lahore"
              value={form.city}
              onChangeText={(t) => setForm((f) => ({ ...f, city: t }))}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Latitude"
                  placeholder="31.5204"
                  value={form.latitude}
                  onChangeText={(t) => setForm((f) => ({ ...f, latitude: t }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Field
                  label="Longitude"
                  placeholder="74.3587"
                  value={form.longitude}
                  onChangeText={(t) => setForm((f) => ({ ...f, longitude: t }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Opening"
                  value={form.openingTime}
                  onChangeText={(t) => setForm((f) => ({ ...f, openingTime: t }))}
                  placeholder="09:00"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Field
                  label="Closing"
                  value={form.closingTime}
                  onChangeText={(t) => setForm((f) => ({ ...f, closingTime: t }))}
                  placeholder="22:00"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 8 }]}
              onPress={save}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </PartnerScreenShell>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  helper?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  autoCorrect?: boolean;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  helper,
  multiline,
  autoCapitalize = 'sentences',
  autoCorrect = true,
}: FieldProps) {
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        style={[styles.input, multiline && styles.inputMultiline]}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
      />
      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 999,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  switchHint: {
    marginTop: 6,
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  helperText: {
    marginTop: 3,
    fontSize: 11,
    color: '#94a3b8',
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
  },
  galleryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f172a',
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  galleryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  linkMuted: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#facc15',
  },
});

