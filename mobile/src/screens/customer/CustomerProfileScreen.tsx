import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { useAuthStore } from '@store/auth';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { tokens } from '@theme/tokens';

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
    <CustomerScreenShell
      title="Account"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{me?.name ?? user?.name ?? '—'}</Text>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{me?.phone ?? user?.phone ?? '—'}</Text>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{me?.email ?? user?.email ?? '—'}</Text>
          </View>
        )}
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 120 },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 16,
    ...tokens.shadowSoft
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    color: tokens.slate500,
    textTransform: 'uppercase'
  },
  value: { marginTop: 2, fontSize: 14, fontWeight: '500', color: tokens.slate800 }
});
