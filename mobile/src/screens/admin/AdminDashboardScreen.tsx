import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

const POLL_MS = 20000;

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
  contributionMargin?: {
    avgOrderValue: number;
    commission: number;
    serviceFee: number;
    riderCost: number;
    net: number;
  };
}

interface Alerts {
  ordersPendingStuck: { id: string; storeName?: string; createdAt?: string }[];
  ordersReadyStuck: string[];
  storesClosedDuringHours: { id: string; name: string }[];
  ridersInactiveOver2Hours: { id: string; name?: string }[];
}

export function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([
      api.get<Metrics>('/admin/metrics').then((r) => r.data),
      api.get<Alerts>('/admin/alerts').then((r) => r.data),
    ])
      .then(([m, a]) => {
        setMetrics(m ?? null);
        setAlerts(a ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const goTab = (tab: string, screen?: string) => {
    const parent = navigation.getParent();
    if (!parent) return;
    if (screen) {
      parent.navigate(tab as never, { screen } as never);
    } else {
      parent.navigate(tab as never);
    }
  };

  const counts = metrics?.orderCountsByStatus ?? {
    pending: 0,
    preparing: 0,
    readyForPickup: 0,
    outForDelivery: 0,
    cancelledToday: 0,
  };

  const alertCount =
    (alerts?.ordersPendingStuck?.length ?? 0) +
    (alerts?.ordersReadyStuck?.length ?? 0) +
    (alerts?.storesClosedDuringHours?.length ?? 0) +
    (alerts?.ridersInactiveOver2Hours?.length ?? 0);

  return (
    <PartnerScreenShell title="VYBE Admin" scrollable={false} bottomPadding="nav">
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.welcome}>Welcome, {user?.name ?? 'Admin'}</Text>

        <Text style={styles.sectionLabel}>Shortcuts</Text>
        <View style={styles.shortcuts}>
          <Shortcut title="Orders" onPress={() => goTab('AdminOrdersTab', 'AdminOrders')} />
          <Shortcut title="Stores" onPress={() => goTab('AdminStoresTab', 'AdminStores')} />
          <Shortcut title="Finance" onPress={() => goTab('AdminFinanceTab', 'AdminFinance')} />
          <Shortcut title="More" onPress={() => goTab('AdminMoreTab', 'AdminMoreMenu')} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <>
            {alertCount > 0 && (
              <View style={styles.alertBanner}>
                <Text style={styles.alertTitle}>Attention</Text>
                <Text style={styles.alertText}>
                  {alertCount} alert{alertCount === 1 ? '' : 's'} — check orders, stores, and riders on
                  web for full detail.
                </Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Today</Text>
            <View style={styles.kpiGrid}>
              <Kpi label="Orders today" value={String(metrics?.ordersToday ?? 0)} />
              <Kpi label="Revenue today" value={`Rs ${(metrics?.revenueToday ?? 0).toLocaleString()}`} accent />
              <Kpi label="Pending" value={String(counts.pending)} />
              <Kpi label="Preparing" value={String(counts.preparing)} />
              <Kpi label="Ready" value={String(counts.readyForPickup)} />
              <Kpi label="Out for delivery" value={String(counts.outForDelivery)} />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Platform</Text>
            <View style={styles.kpiGrid}>
              <Kpi label="Total orders" value={String(metrics?.totalOrders ?? 0)} />
              <Kpi label="Total revenue" value={`Rs ${(metrics?.totalRevenue ?? 0).toLocaleString()}`} />
              <Kpi label="Users" value={String(metrics?.totalUsers ?? 0)} />
              <Kpi label="Active riders" value={String(metrics?.activeRiders ?? 0)} />
              <Kpi label="Active stores" value={String(metrics?.activeStores ?? 0)} />
              <Kpi label="Avg delivery" value={`${metrics?.avgDeliveryTimeMins ?? 0} min`} />
              <Kpi label="Cancel rate" value={`${metrics?.cancellationRate ?? 0}%`} />
            </View>

            {metrics?.contributionMargin && (
              <View style={styles.marginCard}>
                <Text style={styles.marginTitle}>Contribution margin (model)</Text>
                <Text style={styles.marginRow}>
                  Net ≈ Rs {Number(metrics.contributionMargin.net).toFixed(0)} / order
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </PartnerScreenShell>
  );
}

function Shortcut({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.shortcutText}>{title}</Text>
    </TouchableOpacity>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, accent && styles.kpiValueAccent]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  welcome: {
    fontSize: 15,
    color: tokens.slate600,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.slate500,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  shortcut: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusButton,
    backgroundColor: tokens.accent,
  },
  shortcutText: {
    color: tokens.white,
    fontWeight: '600',
    fontSize: 13,
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  alertBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: tokens.radiusCard,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
  },
  alertTitle: { fontWeight: '700', color: '#92400e', marginBottom: 4 },
  alertText: { fontSize: 13, color: '#a16207' },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpi: {
    width: '47%',
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusCard,
    padding: 12,
    ...tokens.shadowSoft,
  },
  kpiLabel: {
    fontSize: 11,
    color: tokens.slate500,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.slate800,
  },
  kpiValueAccent: {
    color: tokens.accent,
  },
  marginCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.slate100,
    borderLeftWidth: 4,
    borderLeftColor: tokens.accent,
  },
  marginTitle: { fontWeight: '600', color: tokens.slate800, marginBottom: 4 },
  marginRow: { fontSize: 14, color: tokens.slate600 },
});
