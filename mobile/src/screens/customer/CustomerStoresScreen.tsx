import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

interface StoreSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  products: { id: string; name: string; price: number }[];
}

export function CustomerStoresScreen() {
  const navigation = useNavigation<any>();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<StoreSummary[]>('/stores')
      .then((res) => setStores(res.data ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stores</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0ea5e9" />
          </View>
        ) : stores.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No stores available</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={stores}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            renderItem={({ item }) => {
              const firstProduct = item.products[0];
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('StoreDetail', { id: item.id, name: item.name })
                  }
                >
                  <View style={styles.cardImagePlaceholder} />
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardPrice}>
                    {firstProduct ? `From Rs ${Number(firstProduct.price).toFixed(0)}` : '—'}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  back: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '500'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b'
  },
  list: {
    paddingBottom: 24,
    gap: 12
  },
  card: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 10,
    shadowColor: '#020617',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    marginBottom: 8
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  cardPrice: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316'
  }
});

