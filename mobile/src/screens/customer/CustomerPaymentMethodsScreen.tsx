import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

interface CardInfo {
  id: string;
  last4: string;
  cardType: string;
  isDefault?: boolean;
}

export function CustomerPaymentMethodsScreen() {
  const navigation = useNavigation<any>();
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CardInfo[]>('/profile/payment-methods')
      .then((r) => setCards(r.data ?? []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          &lt; Back
        </Text>
        <Text style={styles.headerTitle}>Payment methods</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0ea5e9" />
          </View>
        ) : (
          <>
            <FlatList
              data={cards}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingBottom: 16, gap: 10 }}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View>
                    <Text style={styles.cardLabel}>•••• {item.last4}</Text>
                    <Text style={styles.cardSub}>{item.cardType}</Text>
                  </View>
                  {item.isDefault && (
                    <Text style={styles.defaultBadge}>Default</Text>
                  )}
                </View>
              )}
            />
            {cards.length === 0 && (
              <Text style={styles.empty}>No cards added yet.</Text>
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
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cardSub: { marginTop: 2, fontSize: 12, color: '#64748b' },
  defaultBadge: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    color: '#facc15',
    fontWeight: '500'
  },
  empty: { marginTop: 8, fontSize: 13, color: '#6b7280' }
});

