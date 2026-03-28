import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { tokens } from '@theme/tokens';

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
    <CustomerScreenShell
      title="Stores"
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
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: tokens.slate500
  },
  list: {
    paddingBottom: 24,
    gap: 12
  },
  card: {
    flex: 1,
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 10,
    ...tokens.shadowSoft
  },
  cardImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: tokens.slate200,
    marginBottom: 8
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800
  },
  cardPrice: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.accent
  }
});
