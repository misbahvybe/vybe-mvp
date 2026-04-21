import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';
import { formatOrderNo } from '@lib/orderDisplay';

interface StoreEarningsToday {
  orders: number;
  revenue: number;
  commission: number;
  net: number;
}

interface EarningHistoryRow {
  orderId: string;
  orderNumber?: number;
  createdAt: string;
  storeAmount: number;
  commissionAmount: number;
}

interface StoreEarnings {
  today: StoreEarningsToday;
  history: EarningHistoryRow[];
}

export function StoreEarningsScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const [earnings, setEarnings] = useState<StoreEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<StoreEarnings>('/store-owner/earnings')
      .then((res) => setEarnings(res.data ?? null))
      .catch(() => setEarnings(null))
      .finally(() => setLoading(false));
  }, []);

  const openWithdraw = () => {
    if (!earnings) return;
    setWithdrawAmount(String(earnings.today.net));
    setWithdrawOpen(true);
  };

  const submitWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount');
      return;
    }
    setWithdrawSubmitting(true);
    try {
      await api.post('/withdraw/request', { amount });
      setWithdrawOpen(false);
      Alert.alert(
        'Request submitted',
        'Withdraw request submitted. Admin will process within 24 hours.',
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to submit withdraw request';
      Alert.alert('Error', String(msg));
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const today = earnings?.today;
  const history = earnings?.history ?? [];

  const goOrders = () =>
    navigation.getParent()?.navigate('StoreOrdersTab', { screen: 'StoreOrders' });
  const goProducts = () =>
    navigation.getParent()?.navigate('StoreProductsTab', { screen: 'StoreProducts' });
  const goSettings = () =>
    navigation.getParent()?.navigate('StoreSettingsTab', { screen: 'StoreSettings' });

  return (
    <PartnerScreenShell title="Earnings" bottomPadding="nav" scrollable={false}>
      <View style={styles.scrollWrap}>
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.headerSubtitle}>
          Welcome, {user?.name ?? 'Store Owner'}!
        </Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.card} onPress={goOrders}>
            <Text style={styles.cardLabel}>Orders</Text>
            <Text style={styles.cardValue}>
              {today ? today.orders : '—'}
            </Text>
            <Text style={styles.cardHint}>View and manage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={goProducts}>
            <Text style={styles.cardLabel}>Products</Text>
            <Text style={styles.cardValue}>Manage</Text>
            <Text style={styles.cardHint}>Categories {'&'} items</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Today Revenue</Text>
            <Text style={styles.cardValue}>
              {today ? `${today.revenue.toLocaleString()} PKR` : '—'}
            </Text>
            <Text style={styles.cardHint}>Before commission</Text>
          </View>
          <TouchableOpacity style={styles.card} onPress={goSettings}>
            <Text style={styles.cardLabel}>Store</Text>
            <Text style={styles.cardValue}>Settings</Text>
            <Text style={styles.cardHint}>Name, hours, address</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.earningsCard}>
          <View>
            <Text style={styles.earningsLabel}>Available balance</Text>
            <Text style={styles.earningsValue}>
              {today ? `${today.net.toLocaleString()} PKR` : loading ? 'Loading…' : '0 PKR'}
            </Text>
          </View>
          <VybeButton
            title="Request Withdraw"
            variant="accent"
            size="md"
            loading={loading}
            disabled={!today || loading}
            onPress={openWithdraw}
          />
        </View>

        <Text style={styles.historyTitle}>Recent earnings (delivered)</Text>
        {history.length === 0 ? (
          <Text style={styles.historyEmpty}>No earnings history yet.</Text>
        ) : (
          history.map((h) => (
            <View key={h.orderId} style={styles.historyRow}>
              <View>
                <Text style={styles.historyOrder}>{formatOrderNo(h.orderNumber, h.orderId)}</Text>
                <Text style={styles.historyDate}>
                  {new Date(h.createdAt).toLocaleString('en-GB', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.historyNet}>+{h.storeAmount.toLocaleString()} PKR</Text>
                <Text style={styles.historyComm}>Fee {h.commissionAmount.toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}
        </ScrollView>

        <Modal visible={withdrawOpen} transparent animationType="fade" onRequestClose={() => setWithdrawOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Withdraw amount (PKR)</Text>
              <TextInput
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="decimal-pad"
                style={styles.modalInput}
                placeholder="Amount"
              />
              <TouchableOpacity
                style={[styles.modalPrimary, withdrawSubmitting && { opacity: 0.6 }]}
                disabled={withdrawSubmitting}
                onPress={submitWithdraw}
              >
                {withdrawSubmitting ? (
                  <ActivityIndicator color="#facc15" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Submit request</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setWithdrawOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { flex: 1 },
  scrollFlex: { flex: 1 },
  headerSubtitle: {
    marginBottom: 16,
    fontSize: 14,
    color: tokens.slate600
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.slate800,
    marginTop: 20,
    marginBottom: 10,
  },
  historyEmpty: { fontSize: 13, color: tokens.slate500 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate200,
  },
  historyOrder: { fontSize: 13, fontWeight: '700', color: tokens.slate800 },
  historyDate: { fontSize: 11, color: tokens.slate400, marginTop: 2 },
  historyNet: { fontSize: 14, fontWeight: '700', color: tokens.accent },
  historyComm: { fontSize: 11, color: tokens.slate500, marginTop: 2 },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  card: {
    flex: 1,
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 14,
    ...tokens.shadowSoft
  },
  cardLabel: {
    fontSize: 12,
    color: tokens.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.slate800
  },
  cardHint: {
    marginTop: 4,
    fontSize: 11,
    color: tokens.slate400
  },
  earningsCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...tokens.shadowSoft
  },
  earningsLabel: {
    fontSize: 12,
    color: tokens.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.accent
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    padding: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.slate800,
    marginBottom: 10
  },
  modalInput: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: tokens.slate800,
    marginBottom: 12
  },
  modalPrimary: {
    borderRadius: 999,
    backgroundColor: tokens.primaryDark,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#facc15'
  },
  modalCancel: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  modalCancelText: { fontSize: 14, fontWeight: '500', color: tokens.slate600 }
});
