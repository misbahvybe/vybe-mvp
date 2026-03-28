import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeCard } from '@components/ui/VybeCard';
import { tokens } from '@theme/tokens';

const SHOP_FRONT =
  'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0';

interface StoreSummary {
  id: string;
  name: string;
  description: string | null;
  products: { id: string; name: string; price: number }[];
}

export function CustomerSearchScreen() {
  const navigation = useNavigation<any>();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    api
      .get<StoreSummary[]>('/stores')
      .then((r) => setStores(r.data ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!debounced.trim()) return stores;
    const q = debounced.toLowerCase();
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
    );
  }, [stores, debounced]);

  return (
    <CustomerScreenShell
      title="Search"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
      scrollable={false}
    >
      <View style={styles.inner}>
        <TextInput
          style={styles.input}
          placeholder="Search stores..."
          placeholderTextColor={tokens.slate400}
          value={search}
          onChangeText={setSearch}
          autoFocus
          autoCorrect={false}
        />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(s) => s.id}
            contentContainerStyle={styles.listPad}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <VybeCard style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {search ? 'No stores match your search' : 'Start typing to search'}
                </Text>
              </VybeCard>
            }
            renderItem={({ item }) => {
              const first = item.products[0];
              return (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('StoreDetail', { id: item.id, name: item.name })
                  }
                  activeOpacity={0.85}
                >
                  <VybeCard style={styles.rowCard}>
                    <View style={styles.thumbWrap}>
                      <Image source={{ uri: SHOP_FRONT }} style={styles.thumb} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.storeName}>{item.name}</Text>
                      <Text style={styles.fromPrice}>
                        {first ? `From Rs ${Number(first.price).toFixed(0)}` : '—'}
                      </Text>
                    </View>
                  </VybeCard>
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
  inner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.slate300,
    borderRadius: tokens.radiusButton,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: tokens.slate800,
    marginBottom: 16
  },
  listPad: { paddingBottom: 24, gap: 12 },
  rowCard: {
    flexDirection: 'row',
    gap: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center'
  },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: tokens.radiusButton,
    overflow: 'hidden',
    backgroundColor: tokens.slate100
  },
  thumb: { width: '100%', height: '100%' },
  rowText: { flex: 1, minWidth: 0 },
  storeName: { fontSize: 16, fontWeight: '600', color: tokens.slate800 },
  fromPrice: { marginTop: 4, fontSize: 14, fontWeight: '600', color: tokens.accent },
  emptyCard: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: tokens.slate500, fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }
});
