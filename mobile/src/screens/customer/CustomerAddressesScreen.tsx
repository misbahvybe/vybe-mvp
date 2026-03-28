import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

interface Address {
  id: string;
  label?: string | null;
  fullAddress: string;
  isDefault?: boolean;
}

export function CustomerAddressesScreen() {
  const navigation = useNavigation<any>();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAddresses = () => {
    api
      .get<Address[]>('/users/me/addresses')
      .then((r) => setAddresses(r.data ?? []))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  return (
    <CustomerScreenShell
      title="Addresses"
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
        ) : (
          <>
            <FlatList
              data={addresses}
              keyExtractor={(a) => a.id}
              contentContainerStyle={{ paddingBottom: 16, gap: 10, paddingHorizontal: 16, paddingTop: 8 }}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addrTitle}>{item.label || 'Address'}</Text>
                    <Text style={styles.addrText}>{item.fullAddress}</Text>
                    {item.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
                  </View>
                </View>
              )}
            />
            <View style={styles.footer}>
              <VybeButton
                title="Add new address"
                variant="accent"
                fullWidth
                onPress={() => navigation.navigate('CustomerAddressForm')}
              />
            </View>
          </>
        )}
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    ...tokens.shadowSoft
  },
  addrTitle: { fontSize: 14, fontWeight: '600', color: tokens.slate800 },
  addrText: { fontSize: 13, color: tokens.slate500, marginTop: 4 },
  defaultBadge: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: tokens.accent
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.slate200,
    backgroundColor: tokens.surface
  }
});
