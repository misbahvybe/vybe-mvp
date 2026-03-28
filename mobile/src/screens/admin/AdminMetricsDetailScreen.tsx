import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

interface Metrics {
  totalUsers: number;
  totalOrders: number;
  ordersToday: number;
  revenueToday: number;
  totalRevenue: number;
  activeRiders: number;
  activeStores: number;
  avgDeliveryTimeMins: number;
  cancellationRate: string;
  orderCountsByStatus: {
    pending: number;
    preparing: number;
    readyForPickup: number;
    outForDelivery: number;
    cancelledToday: number;
  };
}

export function AdminMetricsDetailScreen() {
  const navigation = useNavigation<any>();
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Metrics>('/admin/metrics')
      .then((r) => setM(r.data ?? null))
      .catch(() => setM(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PartnerScreenShell
      title="Metrics"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : !m ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Could not load metrics.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          <Stat label="Total users" value={String(m.totalUsers)} />
          <Stat label="Total orders" value={String(m.totalOrders)} />
          <Stat label="Orders today" value={String(m.ordersToday)} />
          <Stat label="Revenue today (commission)" value={`Rs ${m.revenueToday.toLocaleString()}`} />
          <Stat label="Total revenue (commission)" value={`Rs ${m.totalRevenue.toLocaleString()}`} />
          <Stat label="Active riders" value={String(m.activeRiders)} />
          <Stat label="Active stores" value={String(m.activeStores)} />
          <Stat label="Avg delivery time" value={`${m.avgDeliveryTimeMins} min`} />
          <Stat label="Cancellation rate" value={`${m.cancellationRate}%`} />
          <Text style={styles.subhead}>Pipeline</Text>
          <Stat label="Pending" value={String(m.orderCountsByStatus.pending)} />
          <Stat label="Preparing" value={String(m.orderCountsByStatus.preparing)} />
          <Stat label="Ready for pickup" value={String(m.orderCountsByStatus.readyForPickup)} />
          <Stat label="Out for delivery" value={String(m.orderCountsByStatus.outForDelivery)} />
          <Stat label="Cancelled today" value={String(m.orderCountsByStatus.cancelledToday)} />
        </ScrollView>
      )}
    </PartnerScreenShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },
  empty: { color: tokens.slate500 },
  subhead: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: tokens.slate500,
    textTransform: 'uppercase'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate200
  },
  label: { fontSize: 14, color: tokens.slate600, flex: 1, marginRight: 8 },
  value: { fontSize: 14, fontWeight: '600', color: tokens.slate800 }
});
