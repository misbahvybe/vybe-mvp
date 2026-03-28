import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

interface Address {
  id: string;
  label?: string | null;
  fullAddress: string;
  isDefault?: boolean;
}

export function CustomerAddressFormScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id: string | undefined = route.params?.id;

  const [form, setForm] = useState<{ label: string; fullAddress: string }>({
    label: '',
    fullAddress: ''
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);

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
          setForm({
            label: addr.label ?? '',
            fullAddress: addr.fullAddress
          });
        }
      })
      .finally(() => setInitialLoading(false));
  }, [id]);

  const save = async () => {
    if (!form.fullAddress.trim()) {
      Alert.alert('Validation', 'Please enter full address');
      return;
    }
    setLoading(true);
    try {
      if (id) {
        await api.patch(`/users/me/addresses/${id}`, {
          label: form.label || undefined,
          fullAddress: form.fullAddress
        });
      } else {
        await api.post('/users/me/addresses', {
          label: form.label || undefined,
          fullAddress: form.fullAddress
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

  return (
    <CustomerScreenShell
      title={id ? 'Edit address' : 'Add address'}
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <View style={styles.body}>
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
            placeholder="Street, area, city..."
            placeholderTextColor={tokens.slate400}
            value={form.fullAddress}
            onChangeText={(text) => setForm((f) => ({ ...f, fullAddress: text }))}
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
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  centerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48
  },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 16,
    ...tokens.shadowSoft
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
    backgroundColor: tokens.surface
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top'
  }
});
