import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { useAuthStore } from '@store/auth';

interface MeResponse {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

export function CustomerProfileScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<MeResponse>('/users/me')
      .then((r) => setMe(r.data))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          &lt; Back
        </Text>
        <Text style={styles.headerTitle}>Account information</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0ea5e9" />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{me?.name ?? user?.name ?? '—'}</Text>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{me?.phone ?? user?.phone ?? '—'}</Text>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{me?.email ?? '—'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  label: { marginTop: 8, fontSize: 12, color: '#64748b', textTransform: 'uppercase' },
  value: { marginTop: 2, fontSize: 14, fontWeight: '500', color: '#0f172a' }
});

