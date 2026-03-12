import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

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
      <View style={styles.centerRoot}>
        <ActivityIndicator color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          &lt; Back
        </Text>
        <Text style={styles.headerTitle}>{id ? 'Edit address' : 'Add address'}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Label</Text>
          <TextInput
            style={styles.input}
            placeholder="Home, Office, etc."
            value={form.label}
            onChangeText={(text) => setForm((f) => ({ ...f, label: text }))}
          />
          <Text style={styles.label}>Full address</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            multiline
            placeholder="Street, area, city..."
            value={form.fullAddress}
            onChangeText={(text) => setForm((f) => ({ ...f, fullAddress: text }))}
          />
          <TouchableOpacity style={styles.saveButton} onPress={save} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.saveButtonText}>{id ? 'Save changes' : 'Add address'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  centerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc'
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  back: { color: '#0ea5e9', fontSize: 14, fontWeight: '500' },
  headerTitle: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  label: { marginTop: 8, fontSize: 13, color: '#64748b' },
  input: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a'
  },
  saveButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    alignItems: 'center'
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#facc15'
  }
});

