import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

export function CustomerMoreScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const goWallet = () =>
    navigation.getParent()?.navigate('WalletTab', { screen: 'CustomerWallet' });
  const goOrders = () =>
    navigation.getParent()?.navigate('OrdersTab', { screen: 'CustomerOrders' });

  return (
    <CustomerScreenShell title="More" scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        {user && (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name?.charAt(0) ?? '?'}</Text>
            </View>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.phone}>{user.phone}</Text>
            {user.email ? <Text style={styles.email}>{user.email}</Text> : null}
          </View>
        )}
        <View style={styles.menuCard}>
          <MenuItem
            label="Account Information"
            onPress={() => navigation.navigate('CustomerProfile')}
          />
          <MenuItem
            label="Delivery Addresses"
            onPress={() => navigation.navigate('CustomerAddresses')}
          />
          <MenuItem label="Wallet" onPress={goWallet} />
          <MenuItem
            label="Payment Methods"
            onPress={() => navigation.navigate('CustomerPaymentMethods')}
          />
          <MenuItem label="My Orders" onPress={goOrders} />
          <MenuItem
            label="Change password"
            onPress={() => navigation.navigate('CustomerMorePassword')}
          />
          <MenuItem
            label="Refer friends"
            onPress={() => navigation.navigate('CustomerRefer')}
            isLast
          />
        </View>
        <VybeButton title="Log out" variant="primary" fullWidth onPress={() => logout()} />
      </ScrollView>
    </CustomerScreenShell>
  );
}

function MenuItem({
  label,
  onPress,
  isLast
}: {
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, isLast && styles.menuItemLast]}
      onPress={onPress}
    >
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 4
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.primaryDark,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: tokens.accent },
  name: { marginTop: 8, fontSize: 16, fontWeight: '600', color: tokens.slate800 },
  phone: { marginTop: 2, fontSize: 13, color: tokens.slate500 },
  email: { marginTop: 4, fontSize: 12, color: tokens.slate400 },
  menuCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    paddingVertical: 4,
    ...tokens.shadowSoft
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate200
  },
  menuItemLast: {
    borderBottomWidth: 0
  },
  menuLabel: { fontSize: 14, color: tokens.slate800, fontWeight: '500' },
  menuChevron: { fontSize: 16, color: tokens.slate300 }
});
