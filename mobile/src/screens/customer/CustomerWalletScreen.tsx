import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

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
  const navigation = useNavigation<any>();
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
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          &lt; Back
        </Text>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0ea5e9" />
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
                contentContainerStyle={{ paddingBottom: 16, gap: 8 }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  back: { color: '#0ea5e9', fontSize: 14, fontWeight: '500' },
  headerTitle: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  balanceCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  balanceLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase' },
  balanceValue: { marginTop: 4, fontSize: 22, fontWeight: '700', color: '#f97316' },
  historyTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  txnCard: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  txnType: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  txnDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txnAmount: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  empty: { marginTop: 8, fontSize: 13, color: '#6b7280' }
});

