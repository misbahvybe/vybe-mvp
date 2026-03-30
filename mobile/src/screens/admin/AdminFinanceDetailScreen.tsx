import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Share,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

export interface AdminFinanceDetailScreenProps {
  /** When true, used as a tab root (no back button). */
  hideBack?: boolean;
}

interface FinanceResponse {
  today: {
    grossGmv: number;
    platformCommission: number;
    serviceFeesCollected: number;
    deliveryFeesCollected: number;
    riderCost: number;
    netPlatformRevenue: number;
  };
  month: {
    totalGmv: number;
    totalCommission: number;
    totalServiceFees: number;
    totalDeliveryFees: number;
    riderCost: number;
    cancellationLoss: number;
    cancelledOrders: number;
  };
}

interface WithdrawRequest {
  id: string;
  userId: string;
  role: string;
  amount: number | string;
  status: string;
  note?: string | null;
  createdAt: string;
  processedAt?: string | null;
  user: {
    id: string;
    name: string;
    email?: string | null;
    phone: string;
    role: string;
  };
}

type WithdrawAction = 'APPROVED' | 'REJECTED' | 'PAID';

export function AdminFinanceDetailScreen(props?: AdminFinanceDetailScreenProps) {
  const hideBack = props?.hideBack === true;
  const navigation = useNavigation<any>();
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawModal, setWithdrawModal] = useState<{
    id: string;
    action: WithdrawAction;
    title: string;
  } | null>(null);
  const [withdrawNote, setWithdrawNote] = useState('');
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<FinanceResponse>('/admin/finance').then((r) => r.data ?? null),
      api.get<WithdrawRequest[]>('/withdraw/requests').then((r) => r.data ?? []),
    ])
      .then(([fin, wd]) => {
        setData(fin);
        setWithdraws(wd);
      })
      .catch(() => {
        setData(null);
        setWithdraws([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Today', 'This Month'],
      ['Gross GMV', data.today.grossGmv, data.month.totalGmv],
      ['Platform Commission (15%)', data.today.platformCommission, data.month.totalCommission],
      ['Service Fees', data.today.serviceFeesCollected, data.month.totalServiceFees],
      ['Delivery Fees', data.today.deliveryFeesCollected, data.month.totalDeliveryFees],
      ['Rider Cost', data.today.riderCost, data.month.riderCost],
      ['Net Platform Revenue', data.today.netPlatformRevenue, '-'],
      ['Cancellations', '-', data.month.cancelledOrders],
      ['Cancellation Loss', '-', data.month.cancellationLoss],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    try {
      await Share.share({
        message: csv,
        title: `vybe-finance-${new Date().toISOString().slice(0, 10)}`,
      });
    } catch {
      Alert.alert('Share failed', 'Could not open the share sheet.');
    }
  };

  const openWithdrawAction = (w: WithdrawRequest, action: WithdrawAction, title: string) => {
    setWithdrawNote(w.note ?? '');
    setWithdrawModal({ id: w.id, action, title });
  };

  const submitWithdrawPatch = async () => {
    if (!withdrawModal) return;
    setPatchingId(withdrawModal.id);
    try {
      const { data: updated } = await api.patch<WithdrawRequest>(`/withdraw/requests/${withdrawModal.id}`, {
        status: withdrawModal.action,
        note: withdrawNote.trim() || undefined,
      });
      setWithdraws((list) => list.map((it) => (it.id === updated.id ? updated : it)));
      setWithdrawModal(null);
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Failed to update'));
    } finally {
      setPatchingId(null);
    }
  };

  const statusStyle = (s: string) => {
    if (s === 'PAID') return styles.badgePaid;
    if (s === 'REJECTED') return styles.badgeRejected;
    if (s === 'APPROVED') return styles.badgeApproved;
    return styles.badgePending;
  };

  return (
    <PartnerScreenShell
      title="Finance"
      showBack={!hideBack}
      onBack={hideBack ? undefined : () => navigation.goBack()}
      bottomPadding="nav"
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Could not load finance.</Text>
          <VybeButton title="Retry" variant="outline" onPress={load} style={{ marginTop: 12 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
          <View style={styles.exportRow}>
            <Text style={styles.pageHint}>Summary & withdraw queue</Text>
            <TouchableOpacity onPress={exportCsv} style={styles.exportBtn}>
              <Text style={styles.exportBtnText}>Export CSV</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>Today</Text>
          <Row label="Gross GMV" value={data.today.grossGmv} />
          <Row label="Platform commission" value={data.today.platformCommission} />
          <Row label="Service fees" value={data.today.serviceFeesCollected} />
          <Row label="Delivery fees" value={data.today.deliveryFeesCollected} />
          <Row label="Rider cost" value={data.today.riderCost} />
          <Row label="Net platform revenue" value={data.today.netPlatformRevenue} accent />

          <Text style={[styles.section, { marginTop: 20 }]}>Month</Text>
          <Row label="Total GMV" value={data.month.totalGmv} />
          <Row label="Commission" value={data.month.totalCommission} />
          <Row label="Service fees" value={data.month.totalServiceFees} />
          <Row label="Delivery fees" value={data.month.totalDeliveryFees} />
          <Row label="Rider cost" value={data.month.riderCost} />
          <Row label="Cancelled orders" value={data.month.cancelledOrders} plain />
          <Row label="Cancellation loss (subtotal)" value={data.month.cancellationLoss} />

          <Text style={[styles.section, { marginTop: 24 }]}>Withdraw requests</Text>
          {withdraws.length === 0 ? (
            <Text style={styles.withdrawEmpty}>No withdraw requests yet.</Text>
          ) : (
            withdraws.map((w) => (
              <View key={w.id} style={styles.wCard}>
                <View style={styles.wRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wName}>{w.user?.name ?? '—'}</Text>
                    <Text style={styles.wPhone}>{w.user?.phone}</Text>
                    <Text style={styles.wRole}>{w.role}</Text>
                  </View>
                  <Text style={styles.wAmount}>Rs {Number(w.amount).toLocaleString()}</Text>
                </View>
                <View style={styles.wMeta}>
                  <Text style={[styles.badge, statusStyle(w.status)]}>{w.status}</Text>
                  <Text style={styles.wDate}>
                    {new Date(w.createdAt).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </Text>
                </View>
                {w.note ? <Text style={styles.wNote}>Note: {w.note}</Text> : null}
                <View style={styles.wActions}>
                  {w.status === 'PENDING' && (
                    <>
                      <View style={styles.wActionBtn}>
                        <VybeButton
                          fullWidth
                          title="Approve"
                          variant="outline"
                          onPress={() => openWithdrawAction(w, 'APPROVED', 'Approve request')}
                        />
                      </View>
                      <View style={styles.wActionBtn}>
                        <VybeButton
                          fullWidth
                          title="Reject"
                          variant="outline"
                          onPress={() => openWithdrawAction(w, 'REJECTED', 'Reject request')}
                        />
                      </View>
                    </>
                  )}
                  {w.status === 'APPROVED' && (
                    <View style={[styles.wActionBtn, { flexBasis: '100%' }]}>
                      <VybeButton
                        fullWidth
                        title="Mark paid"
                        variant="accent"
                        onPress={() => openWithdrawAction(w, 'PAID', 'Mark as paid')}
                      />
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!withdrawModal}
        transparent
        animationType="fade"
        onRequestClose={() => setWithdrawModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{withdrawModal?.title}</Text>
            <Text style={styles.modalHint}>Optional note</Text>
            <TextInput
              value={withdrawNote}
              onChangeText={setWithdrawNote}
              style={styles.modalInput}
              placeholder="Note"
              multiline
            />
            <VybeButton
              title="Confirm"
              variant="accent"
              loading={patchingId === withdrawModal?.id}
              disabled={patchingId === withdrawModal?.id}
              onPress={submitWithdrawPatch}
            />
            <VybeButton title="Cancel" variant="outline" onPress={() => setWithdrawModal(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PartnerScreenShell>
  );
}

function Row({
  label,
  value,
  accent,
  plain,
}: {
  label: string;
  value: number;
  accent?: boolean;
  plain?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent && styles.valueAccent]}>
        {plain ? String(value) : `Rs ${Number(value).toLocaleString()}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },
  empty: { color: tokens.slate500 },
  pageHint: { fontSize: 13, color: tokens.slate500, flex: 1 },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exportBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: tokens.primaryDark,
  },
  exportBtnText: { fontSize: 13, fontWeight: '600', color: tokens.white },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.slate500,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate200,
  },
  label: { fontSize: 14, color: tokens.slate700, flex: 1, marginRight: 8 },
  value: { fontSize: 14, fontWeight: '600', color: tokens.slate800 },
  valueAccent: { color: tokens.accent, fontWeight: '700' },
  withdrawEmpty: { fontSize: 14, color: tokens.slate500, marginBottom: 8 },
  wCard: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusCard,
    padding: 12,
    marginBottom: 10,
    ...tokens.shadowSoft,
  },
  wRow: { flexDirection: 'row', alignItems: 'flex-start' },
  wName: { fontSize: 15, fontWeight: '600', color: tokens.slate800 },
  wPhone: { fontSize: 12, color: tokens.slate500, marginTop: 2 },
  wRole: { fontSize: 11, color: tokens.slate400, marginTop: 2 },
  wAmount: { fontSize: 15, fontWeight: '700', color: tokens.accent },
  wMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  badgePaid: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeRejected: { backgroundColor: '#fee2e2', color: '#991b1b' },
  badgeApproved: { backgroundColor: '#fef3c7', color: '#92400e' },
  badgePending: { backgroundColor: tokens.slate100, color: tokens.slate700 },
  wDate: { fontSize: 11, color: tokens.slate400 },
  wNote: { fontSize: 12, color: tokens.slate500, marginTop: 6 },
  wActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  wActionBtn: { flexGrow: 1, flexBasis: '45%', minWidth: 120 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: tokens.slate800, marginBottom: 8 },
  modalHint: { fontSize: 12, color: tokens.slate500 },
  modalInput: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: 15,
    color: tokens.slate800,
  },
});
