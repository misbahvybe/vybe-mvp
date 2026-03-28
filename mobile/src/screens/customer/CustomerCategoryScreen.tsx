import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  TouchableOpacity
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { tokens } from '@theme/tokens';

interface StoreSummary {
  id: string;
  name: string;
  description: string | null;
  products: { id: string; name: string; price: number }[];
}

export function CustomerCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const type: string = route.params?.type ?? 'grocery';
  const title: string = route.params?.title ?? type;

  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = ['food', 'grocery', 'medicine'].includes(type) ? { category: type } : {};
    api
      .get<StoreSummary[]>('/stores', { params })
      .then((res) => setStores(res.data ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, [type]);

  const filteredStores = useMemo(() => {
    if (!debouncedSearch.trim()) return stores;
    const q = debouncedSearch.toLowerCase();
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
    );
  }, [stores, debouncedSearch]);

  return (
    <CustomerScreenShell
      title={title}
      showBack
      onBack={() => navigation.goBack()}
      scrollable={false}
      bottomPadding="nav"
    >
      <View style={styles.body}>
        <TextInput
          style={styles.search}
          placeholder="Search stores..."
          placeholderTextColor={tokens.slate400}
          value={search}
          onChangeText={setSearch}
        />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : filteredStores.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No stores found</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try a different search term' : 'Check back later for new stores'}
            </Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={filteredStores}
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
  search: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.slate300,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.slate800,
    marginBottom: 12,
    backgroundColor: tokens.surface
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.slate500,
    marginBottom: 4
  },
  emptyText: {
    fontSize: 13,
    color: tokens.slate400
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
