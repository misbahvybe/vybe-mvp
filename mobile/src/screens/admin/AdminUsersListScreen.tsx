import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

interface UserRow {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  isVerified: boolean;
  isActive: boolean;
  ordersCount: number;
  totalSpend: number;
}

export function AdminUsersListScreen() {
  const navigation = useNavigation<any>();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<UserRow[]>('/admin/users')
      .then((r) => setUsers(r.data ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PartnerScreenShell
      title="Customers"
      showBack
      onBack={() => navigation.goBack()}
      scrollable={false}
      bottomPadding="nav"
    >
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
            ListEmptyComponent={<Text style={styles.empty}>No customers.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
                {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
                <Text style={styles.meta}>
                  {item.ordersCount} delivered · Rs {Number(item.totalSpend).toLocaleString()} spend ·{' '}
                  {item.isVerified ? 'Verified' : 'Unverified'} · {item.isActive ? 'Active' : 'Off'}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: tokens.slate500, marginTop: 32 },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    ...tokens.shadowSoft
  },
  name: { fontSize: 15, fontWeight: '600', color: tokens.slate800 },
  phone: { fontSize: 13, color: tokens.slate500, marginTop: 2 },
  email: { fontSize: 12, color: tokens.slate400, marginTop: 2 },
  meta: { fontSize: 12, color: tokens.slate600, marginTop: 6 }
});
