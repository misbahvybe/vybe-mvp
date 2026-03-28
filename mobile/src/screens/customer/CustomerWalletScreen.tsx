import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { tokens } from '@theme/tokens';

interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
}

interface WalletData {
  balance: number;
  history?: WalletTxn[];
}

export function CustomerWalletScreen() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<WalletData>('/wallet')
      .then((r) => setData(r.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CustomerScreenShell title="Wallet" scrollable={false} bottomPadding="nav">
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available balance</Text>
              <Text style={styles.balanceValue}>
                Rs {Number(data?.balance ?? 0).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.historyTitle}>History</Text>
            {data?.history && data.history.length > 0 ? (
              <FlatList
                data={data.history}
                keyExtractor={(t) => t.id}
                contentContainerStyle={{ paddingBottom: 16, gap: 8, paddingHorizontal: 16 }}
                renderItem={({ item }) => (
                  <View style={styles.txnCard}>
                    <View>
                      <Text style={styles.txnType}>{item.type}</Text>
                      <Text style={styles.txnDate}>
                        {new Date(item.createdAt).toLocaleString('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </Text>
                    </View>
                    <Text style={styles.txnAmount}>
                      Rs {Number(item.amount).toLocaleString()}
                    </Text>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.empty}>No wallet activity yet.</Text>
            )}
          </>
        )}
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  balanceCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    ...tokens.shadowSoft
  },
  balanceLabel: { fontSize: 12, color: tokens.slate500, textTransform: 'uppercase' },
  balanceValue: { marginTop: 4, fontSize: 22, fontWeight: '700', color: tokens.accent },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800,
    marginBottom: 8,
    paddingHorizontal: 16
  },
  txnCard: {
    borderRadius: 12,
    backgroundColor: tokens.surface,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...tokens.shadowSoft
  },
  txnType: { fontSize: 13, fontWeight: '600', color: tokens.slate800 },
  txnDate: { fontSize: 11, color: tokens.slate400, marginTop: 2 },
  txnAmount: { fontSize: 13, fontWeight: '600', color: tokens.slate800 },
  empty: { marginTop: 8, fontSize: 13, color: tokens.slate500, paddingHorizontal: 16 }
});
