import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { AddressMapPicker } from '@components/customer/AddressMapPicker';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

interface Address {
  id: string;
  label?: string | null;
  fullAddress: string;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isDefault?: boolean;
}

function parseCoord(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

export function CustomerAddressFormScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id: string | undefined = route.params?.id;

  const [form, setForm] = useState<{ label: string; fullAddress: string; city: string }>({
    label: '',
    fullAddress: '',
    city: 'Lahore',
  });
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);

  const handleMapSelect = useCallback(
    (addressLine: string, city: string, latitude: number, longitude: number) => {
      setForm((f) => ({
        ...f,
        fullAddress: addressLine,
        city: city || f.city || 'Lahore',
      }));
      setLat(latitude);
      setLng(longitude);
    },
    []
  );

  useEffect(() => {
    if (!id) {
      setInitialLoading(false);
      return;
    }
    api
      .get<Address[]>('/users/me/addresses')
      .then((r) => {
        const addr = (r.data ?? []).find((a) => a.id === id);
        if (addr) {
          const la = parseCoord(addr.latitude);
          const lo = parseCoord(addr.longitude);
          setForm({
            label: addr.label ?? '',
            fullAddress: addr.fullAddress,
            city: addr.city ?? 'Lahore',
          });
          if (la != null && lo != null) {
            setLat(la);
            setLng(lo);
          }
        }
      })
      .finally(() => setInitialLoading(false));
  }, [id]);

  const save = async () => {
    if (!form.fullAddress.trim()) {
      Alert.alert('Validation', 'Please set a location on the map (or enter an address).');
      return;
    }
    if (lat == null || lng == null) {
      Alert.alert('Validation', 'Tap the map or drag the pin to set your delivery location.');
      return;
    }
    setLoading(true);
    try {
      const city = form.city.trim() || 'Lahore';
      if (id) {
        await api.patch(`/users/me/addresses/${id}`, {
          label: form.label || undefined,
          fullAddress: form.fullAddress.trim(),
          city,
          latitude: lat,
          longitude: lng,
        });
      } else {
        await api.post('/users/me/addresses', {
          label: form.label || undefined,
          fullAddress: form.fullAddress.trim(),
          city,
          latitude: lat,
          longitude: lng,
        });
      }
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to save address';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <CustomerScreenShell
        title={id ? 'Edit address' : 'Add address'}
        showBack
        onBack={() => navigation.goBack()}
        bottomPadding="nav"
      >
        <View style={styles.centerRoot}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      </CustomerScreenShell>
    );
  }

  const mapKey = id ? `map-${id}` : 'map-new';

  return (
    <CustomerScreenShell
      title={id ? 'Edit address' : 'Add address'}
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AddressMapPicker
          key={mapKey}
          initialLatitude={lat ?? undefined}
          initialLongitude={lng ?? undefined}
          onSelect={handleMapSelect}
        />

        <View style={styles.card}>
          <Text style={styles.label}>Label</Text>
          <TextInput
            style={styles.input}
            placeholder="Home, Office, etc."
            placeholderTextColor={tokens.slate400}
            value={form.label}
            onChangeText={(text) => setForm((f) => ({ ...f, label: text }))}
          />
          <Text style={styles.label}>Full address</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            multiline
            placeholder="Adjust if needed after pinning…"
            placeholderTextColor={tokens.slate400}
            value={form.fullAddress}
            onChangeText={(text) => setForm((f) => ({ ...f, fullAddress: text }))}
          />
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="Lahore"
            placeholderTextColor={tokens.slate400}
            value={form.city}
            onChangeText={(text) => setForm((f) => ({ ...f, city: text }))}
          />
          <VybeButton
            title={id ? 'Save changes' : 'Add address'}
            variant="accent"
            fullWidth
            loading={loading}
            onPress={save}
            style={{ marginTop: 16 }}
          />
        </View>
      </ScrollView>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  centerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  card: {
    marginTop: 16,
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 16,
    ...tokens.shadowSoft,
  },
  label: { marginTop: 8, fontSize: 13, color: tokens.slate500 },
  input: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.slate300,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.slate800,
    backgroundColor: tokens.surface,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
