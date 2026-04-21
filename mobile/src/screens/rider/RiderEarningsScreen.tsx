import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';
import { formatOrderNo } from '@lib/orderDisplay';

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
  orderNumber?: number;
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
    <PartnerScreenShell title="Earnings" bottomPadding="nav">
      {loading ? (
        <View style={[styles.body, styles.center]}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : !data ? (
        <View style={[styles.body, styles.center]}>
          <Text style={styles.emptyText}>Unable to load earnings.</Text>
        </View>
      ) : (
        <View style={styles.body}>
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
                        {formatOrderNo(h.orderNumber, h.orderId)}
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
        </View>
      )}
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
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
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 14,
    ...tokens.shadowSoft,
  },
  cardLabel: {
    fontSize: 12,
    color: tokens.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.slate800,
  },
  cardHint: {
    marginTop: 4,
    fontSize: 11,
    color: tokens.slate400,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  emptyCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 16,
    alignItems: 'center',
    ...tokens.shadowSoft,
  },
  emptyText: {
    fontSize: 13,
    color: tokens.slate400,
  },
  historyCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...tokens.shadowSoft,
  },
  historyOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.slate800,
  },
  historyDate: {
    marginTop: 2,
    fontSize: 11,
    color: tokens.slate400,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.accent,
  },
});

