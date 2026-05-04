import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
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
  codCollectedAmount?: number;
  codBlocked?: boolean;
}

export function AdminRidersListScreen() {
  const navigation = useNavigation<any>();
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get<RiderRow[]>('/admin/riders')
      .then((r) => setRiders(r.data ?? []))
      .catch(() => setRiders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const settle = (riderId: string) => {
    Alert.alert('Settle COD', 'Mark cash as received and reset balance to 0?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settle',
        onPress: () => {
          setSettlingId(riderId);
          api
            .post(`/admin/riders/${riderId}/settle-cod`)
            .then(() => load())
            .catch(() => Alert.alert('Error', 'Settlement failed'))
            .finally(() => setSettlingId(null));
        },
      },
    ]);
  };

  return (
    <PartnerScreenShell
      title="Captains"
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
            ListEmptyComponent={<Text style={styles.empty}>No captains.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
                <Text style={styles.meta}>
                  {item.isActive ? 'Active' : 'Inactive'} · {item.isOnline ? 'Online' : 'Offline'} ·
                  Today {item.ordersToday} · Accept {item.acceptanceRate}%
                  {item.codBlocked ? ' · COD block' : ''}
                </Text>
                <Text style={styles.codLine}>
                  COD held: Rs {Number(item.codCollectedAmount ?? 0).toLocaleString()}
                </Text>
                <Text style={styles.earn}>
                  Lifetime earnings Rs {Number(item.totalEarnings).toLocaleString()}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.settleBtn,
                    (settlingId === item.id || Number(item.codCollectedAmount ?? 0) <= 0) &&
                      styles.settleBtnDisabled,
                  ]}
                  disabled={settlingId === item.id || Number(item.codCollectedAmount ?? 0) <= 0}
                  onPress={() => settle(item.id)}
                >
                  <Text style={styles.settleBtnText}>
                    {settlingId === item.id ? 'Settling…' : 'Mark COD received'}
                  </Text>
                </TouchableOpacity>
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
  earn: { fontSize: 12, fontWeight: '600', color: tokens.accent, marginTop: 4 },
  codLine: { fontSize: 12, fontWeight: '600', color: tokens.slate700, marginTop: 6 },
  settleBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: tokens.slate800,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  settleBtnDisabled: { opacity: 0.45 },
  settleBtnText: { fontSize: 12, fontWeight: '700', color: tokens.primary },
});
