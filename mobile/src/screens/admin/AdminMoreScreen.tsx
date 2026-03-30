import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

export function AdminMoreScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <PartnerScreenShell title="More" scrollable={false} bottomPadding="nav">
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {user && (
          <View style={styles.profile}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.meta}>{user.role}</Text>
            {user.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
          </View>
        )}
        <View style={styles.menu}>
          <MenuRow label="Customers" onPress={() => navigation.navigate('AdminUsers')} />
          <MenuRow label="Riders" onPress={() => navigation.navigate('AdminRiders')} />
          <MenuRow label="Partners" onPress={() => navigation.navigate('AdminPartners')} />
          <MenuRow label="Metrics" onPress={() => navigation.navigate('AdminMetrics')} />
          <MenuRow label="Pricing & commission" onPress={() => navigation.navigate('AdminPricing')} />
          <MenuRow
            label="Settings"
            onPress={() => navigation.navigate('AdminSettings')}
            isLast
          />
        </View>
        <VybeButton title="Log out" variant="primary" fullWidth onPress={() => logout()} />
      </ScrollView>
    </PartnerScreenShell>
  );
}

function MenuRow({
  label,
  onPress,
  isLast,
}: {
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, isLast && styles.menuRowLast]}
      onPress={onPress}
    >
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  profile: {
    marginBottom: 4,
  },
  name: { fontSize: 18, fontWeight: '700', color: tokens.slate800 },
  meta: { fontSize: 13, color: tokens.slate500, marginTop: 2 },
  menu: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    overflow: 'hidden',
    ...tokens.shadowSoft,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate200,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuLabel: { fontSize: 15, fontWeight: '500', color: tokens.slate800 },
  chevron: { fontSize: 18, color: tokens.slate300 },
});
