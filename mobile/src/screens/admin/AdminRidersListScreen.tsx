import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

interface RiderRow {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  isOnline: boolean;
  ordersToday: number;
  totalOrders: number;
  acceptanceRate: string;
  totalEarnings: number;
}

export function AdminRidersListScreen() {
  const navigation = useNavigation<any>();
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<RiderRow[]>('/admin/riders')
      .then((r) => setRiders(r.data ?? []))
      .catch(() => setRiders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PartnerScreenShell
      title="Riders"
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
            data={riders}
            keyExtractor={(x) => x.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
            ListEmptyComponent={<Text style={styles.empty}>No riders.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
                <Text style={styles.meta}>
                  {item.isActive ? 'Active' : 'Inactive'} · {item.isOnline ? 'Online' : 'Offline'} ·
                  Today {item.ordersToday} · Accept {item.acceptanceRate}%
                </Text>
                <Text style={styles.earn}>
                  Lifetime earnings Rs {Number(item.totalEarnings).toLocaleString()}
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
  meta: { fontSize: 12, color: tokens.slate600, marginTop: 6 },
  earn: { fontSize: 12, fontWeight: '600', color: tokens.accent, marginTop: 4 }
});
