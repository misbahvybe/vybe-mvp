import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

interface AdminStoreRow {
  id: string;
  name: string;
  isOpen: boolean;
  ordersToday: number;
  revenueToday: number;
}

export function AdminStoresScreen() {
  const [stores, setStores] = useState<AdminStoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AdminStoreRow[]>('/admin/stores')
      .then((r) => setStores(r.data ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PartnerScreenShell title="Stores" scrollable={false} bottomPadding="nav">
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
            ListEmptyComponent={<Text style={styles.empty}>No stores.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={[styles.badge, item.isOpen ? styles.open : styles.closed]}>
                    {item.isOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  Today: {item.ordersToday} orders · Rs {Number(item.revenueToday).toLocaleString()}{' '}
                  delivered GMV
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
    padding: 14,
    ...tokens.shadowSoft
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', color: tokens.slate800, flex: 1, marginRight: 8 },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  open: { backgroundColor: '#dcfce7', color: '#166534' },
  closed: { backgroundColor: tokens.slate200, color: tokens.slate600 },
  meta: { fontSize: 12, color: tokens.slate500, marginTop: 8 }
});
