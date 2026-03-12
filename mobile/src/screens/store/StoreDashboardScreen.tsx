import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { api } from '@api/client';

interface StoreEarningsToday {
  orders: number;
  revenue: number;
  commission: number;
  net: number;
}

interface StoreEarnings {
  today: StoreEarningsToday;
}

export function StoreDashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const [earnings, setEarnings] = useState<StoreEarnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<StoreEarnings>('/store-owner/earnings')
      .then((res) => setEarnings(res.data ?? null))
      .catch(() => setEarnings(null))
      .finally(() => setLoading(false));
  }, []);

  const handleWithdraw = () => {
    if (!earnings) return;
    const suggested = earnings.today.net;
    const amountStr = prompt?.('Withdraw amount (PKR)', String(suggested));
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount');
      return;
    }
    (async () => {
      try {
        await api.post('/withdraw/request', { amount });
        Alert.alert(
          'Request submitted',
          'Withdraw request submitted. Admin will process within 24 hours.'
        );
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? 'Failed to submit withdraw request';
        Alert.alert('Error', String(msg));
      }
    })();
  };

  const today = earnings?.today;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Store Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          Welcome, {user?.name ?? 'Store Owner'}!
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('StoreOrders')}
          >
            <Text style={styles.cardLabel}>Orders</Text>
            <Text style={styles.cardValue}>
              {today ? today.orders : '—'}
            </Text>
            <Text style={styles.cardHint}>View and manage</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('StoreProducts')}
          >
            <Text style={styles.cardLabel}>Products</Text>
            <Text style={styles.cardValue}>Manage</Text>
            <Text style={styles.cardHint}>Categories & items</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Today Revenue</Text>
            <Text style={styles.cardValue}>
              {today ? `${today.revenue.toLocaleString()} PKR` : '—'}
            </Text>
            <Text style={styles.cardHint}>Before commission</Text>
          </View>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('StoreSettings')}
          >
            <Text style={styles.cardLabel}>Store</Text>
            <Text style={styles.cardValue}>Settings</Text>
            <Text style={styles.cardHint}>Name, hours, address</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.earningsCard}>
          <View>
            <Text style={styles.earningsLabel}>Available balance</Text>
            <Text style={styles.earningsValue}>
              {today ? `${today.net.toLocaleString()} PKR` : loading ? 'Loading…' : '0 PKR'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleWithdraw}
            disabled={!today || loading}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.primaryButtonText}>Request Withdraw</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a'
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b'
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  card: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  cardHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#94a3b8'
  },
  earningsCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  earningsLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f97316'
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 140
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#facc15'
  }
});

