import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

interface CardInfo {
  id: string;
  last4: string;
  brand: string;
  isDefault?: boolean;
}

export function CustomerPaymentMethodsScreen() {
  const navigation = useNavigation<any>();
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState<'Visa' | 'Mastercard'>('Visa');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<CardInfo[]>('/users/me/payment-methods')
      .then((r) => setCards(r.data ?? []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCard = async () => {
    const d = last4.replace(/\D/g, '').slice(-4);
    if (d.length !== 4) {
      Alert.alert('Validation', 'Enter the last 4 digits of the card.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/users/me/payment-methods', {
        last4: d,
        cardType: brand,
        isDefault: cards.length === 0,
      });
      setAddOpen(false);
      setLast4('');
      load();
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Could not add card'));
    } finally {
      setSubmitting(false);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await api.patch(`/users/me/payment-methods/${id}/default`, {});
      load();
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Failed'));
    }
  };

  const removeCard = (id: string) => {
    Alert.alert('Remove card', 'Remove this saved card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/users/me/payment-methods/${id}`);
            load();
          } catch (e: any) {
            Alert.alert('Error', String(e?.response?.data?.message ?? 'Failed'));
          }
        },
      },
    ]);
  };

  return (
    <CustomerScreenShell
      title="Payment methods"
      showBack
      onBack={() => navigation.goBack()}
      scrollable={false}
      bottomPadding="nav"
    >
      <View style={styles.body}>
        <View style={styles.toolbar}>
          <VybeButton title="Add test card" variant="accent" size="md" onPress={() => setAddOpen(true)} />
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingBottom: 24, gap: 10, paddingHorizontal: 16, paddingTop: 8 }}
            ListEmptyComponent={<Text style={styles.empty}>No cards yet. Add a test card for checkout.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>
                    {item.brand} •••• {item.last4}
                  </Text>
                  {item.isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
                </View>
                <View style={styles.rowBtns}>
                  {!item.isDefault ? (
                    <TouchableOpacity onPress={() => setDefault(item.id)}>
                      <Text style={styles.link}>Default</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => removeCard(item.id)}>
                    <Text style={styles.linkDanger}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add card (test / dev)</Text>
            <Text style={styles.hint}>
              For real Stripe cards use the web app. Here you can register Visa/Mastercard test last-4
              like the backend allows.
            </Text>
            <Text style={styles.label}>Last 4 digits</Text>
            <TextInput
              style={styles.input}
              value={last4}
              onChangeText={setLast4}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="4242"
            />
            <Text style={styles.label}>Brand</Text>
            <View style={styles.brandRow}>
              {(['Visa', 'Mastercard'] as const).map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.brandChip, brand === b && styles.brandChipOn]}
                  onPress={() => setBrand(b)}
                >
                  <Text style={[styles.brandText, brand === b && styles.brandTextOn]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <VybeButton title="Save" onPress={addCard} loading={submitting} />
            <VybeButton title="Cancel" variant="outline" onPress={() => setAddOpen(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: 0 },
  toolbar: { paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...tokens.shadowSoft,
  },
  cardLabel: { fontSize: 14, fontWeight: '600', color: tokens.slate800 },
  defaultBadge: { fontSize: 11, fontWeight: '600', color: tokens.accent, marginTop: 4 },
  rowBtns: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  link: { fontSize: 13, fontWeight: '600', color: tokens.accent },
  linkDanger: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  empty: { fontSize: 13, color: tokens.slate500, textAlign: 'center', paddingTop: 24 },
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
  hint: { fontSize: 12, color: tokens.slate500, marginBottom: 12, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.slate700, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    color: tokens.slate800,
  },
  brandRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  brandChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.slate200,
  },
  brandChipOn: { borderColor: tokens.accent, backgroundColor: `${tokens.accent}18` },
  brandText: { fontSize: 13, color: tokens.slate600, fontWeight: '600' },
  brandTextOn: { color: tokens.accent },
});
