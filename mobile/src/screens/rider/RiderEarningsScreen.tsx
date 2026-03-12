import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

interface RiderEarningsToday {
  orders: number;
  amount: number;
}

interface RiderEarningsPeriod {
  orders: number;
  amount: number;
}

interface RiderEarningHistoryItem {
  orderId: string;
  createdAt: string;
  amount: number;
}

interface RiderEarningsResponse {
  today: RiderEarningsToday;
  week: RiderEarningsPeriod;
  total: RiderEarningsPeriod;
  history: RiderEarningHistoryItem[];
}

export function RiderEarningsScreen() {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<RiderEarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<RiderEarningsResponse>('/riders/me/earnings')
      .then((res) => setData(res.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
      </View>
      {loading ? (
        <View style={[styles.body, styles.center]}>
          <ActivityIndicator color="#0ea5e9" />
        </View>
      ) : !data ? (
        <View style={[styles.body, styles.center]}>
          <Text style={styles.emptyText}>Unable to load earnings.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.cardsRow}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Today</Text>
              <Text style={styles.cardValue}>
                {data.today.amount.toLocaleString()} PKR
              </Text>
              <Text style={styles.cardHint}>{data.today.orders} orders</Text>
            </View>
          </View>
          <View style={styles.cardsRow}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>This week</Text>
              <Text style={styles.cardValue}>
                {data.week.amount.toLocaleString()} PKR
              </Text>
              <Text style={styles.cardHint}>{data.week.orders} orders</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Total</Text>
              <Text style={styles.cardValue}>
                {data.total.amount.toLocaleString()} PKR
              </Text>
              <Text style={styles.cardHint}>{data.total.orders} orders</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed orders</Text>
            {data.history.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No completed orders yet.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {data.history.map((h) => (
                  <View key={h.orderId} style={styles.historyCard}>
                    <View>
                      <Text style={styles.historyOrderId}>
                        #{h.orderId.slice(-8).toUpperCase()}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(h.createdAt).toLocaleString('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.historyAmount}>
                      {h.amount.toLocaleString()} PKR
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  back: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
    elevation: 2,
  },
  cardLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#94a3b8',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  historyCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  historyOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyDate: {
    marginTop: 2,
    fontSize: 11,
    color: '#94a3b8',
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
  },
});

