import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

interface PlatformCommission {
  id: string;
  categorySlug: string;
  commissionPercent: string | number;
}

interface StoreRow {
  id: string;
  name: string;
  commissionPercentOverride: number | null;
}

export function AdminPricingScreen() {
  const navigation = useNavigation<any>();
  const [platform, setPlatform] = useState<PlatformCommission[]>([]);
  const [platformEdits, setPlatformEdits] = useState<Record<string, string>>({});
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeEdits, setStoreEdits] = useState<Record<string, string>>({});
  const [newSlug, setNewSlug] = useState('');
  const [newPercent, setNewPercent] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [pc, st] = await Promise.all([
        api.get<PlatformCommission[]>('/admin/pricing/platform-category-commissions'),
        api.get<StoreRow[]>('/admin/stores'),
      ]);
      const list = pc.data ?? [];
      setPlatform(list);
      const edits: Record<string, string> = {};
      for (const row of list) {
        edits[row.categorySlug] = String(row.commissionPercent);
      }
      setPlatformEdits(edits);
      const slist = st.data ?? [];
      setStores(slist);
      const sedits: Record<string, string> = {};
      for (const s of slist) {
        sedits[s.id] =
          s.commissionPercentOverride != null ? String(s.commissionPercentOverride) : '';
      }
      setStoreEdits(sedits);
    } catch {
      Alert.alert('Error', 'Could not load pricing data.');
    }
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await load();
    setLoading(false);
  }, [load]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const savePlatformSlug = async (slug: string) => {
    const raw = platformEdits[slug]?.trim();
    const n = raw === '' ? NaN : Number(raw);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      Alert.alert('Invalid', 'Commission must be between 0 and 100.');
      return;
    }
    setSaving(`pc:${slug}`);
    try {
      await api.patch(`/admin/pricing/platform-category-commissions/${encodeURIComponent(slug)}`, {
        commissionPercent: n,
      });
      Alert.alert('Saved', `${slug} → ${n}%`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Save failed'));
    } finally {
      setSaving(null);
    }
  };

  const addPlatformRule = async () => {
    const slug = newSlug.trim().toLowerCase();
    const n = Number(newPercent);
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      Alert.alert('Invalid slug', 'Use lowercase letters, numbers, hyphen, underscore only.');
      return;
    }
    if (Number.isNaN(n) || n < 0 || n > 100) {
      Alert.alert('Invalid', 'Percent must be 0–100.');
      return;
    }
    setSaving('pc:new');
    try {
      await api.patch(`/admin/pricing/platform-category-commissions/${encodeURIComponent(slug)}`, {
        commissionPercent: n,
      });
      setNewSlug('');
      setNewPercent('');
      Alert.alert('Saved', `Added ${slug} → ${n}%`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Save failed'));
    } finally {
      setSaving(null);
    }
  };

  const saveStoreCommission = async (storeId: string) => {
    const raw = storeEdits[storeId]?.trim();
    let body: { commissionPercentOverride: number | null };
    if (raw === '') {
      body = { commissionPercentOverride: null };
    } else {
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        Alert.alert('Invalid', 'Leave empty for platform rules, or enter 0–100.');
        return;
      }
      body = { commissionPercentOverride: n };
    }
    setSaving(`st:${storeId}`);
    try {
      await api.patch(`/admin/stores/${storeId}/commission-override`, body);
      Alert.alert('Saved', 'Store commission updated.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Save failed'));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <PartnerScreenShell
        title="Pricing"
        showBack
        onBack={() => navigation.goBack()}
        bottomPadding="nav"
      >
        <View style={styles.center}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      </PartnerScreenShell>
    );
  }

  return (
    <PartnerScreenShell
      title="Pricing & commission"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.hint}>
          Category slug must match StoreCategory name in lowercase (e.g. food, grocery). A custom
          rate for a store replaces the category default for that store only.
        </Text>

        <Text style={styles.sectionTitle}>Category defaults</Text>
        {platform.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.slug}>{row.categorySlug}</Text>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={platformEdits[row.categorySlug] ?? ''}
                onChangeText={(t) =>
                  setPlatformEdits((prev) => ({ ...prev, [row.categorySlug]: t }))
                }
                placeholder="%"
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => savePlatformSlug(row.categorySlug)}
                disabled={saving === `pc:${row.categorySlug}`}
              >
                {saving === `pc:${row.categorySlug}` ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {platform.length === 0 && (
          <Text style={styles.empty}>No platform rules yet. Add one below.</Text>
        )}

        <View style={[styles.card, styles.addCard]}>
          <Text style={styles.subLabel}>New category slug</Text>
          <TextInput
            style={styles.inputFull}
            autoCapitalize="none"
            value={newSlug}
            onChangeText={setNewSlug}
            placeholder="e.g. bakery"
          />
          <Text style={[styles.subLabel, { marginTop: 8 }]}>Commission %</Text>
          <TextInput
            style={styles.inputFull}
            keyboardType="decimal-pad"
            value={newPercent}
            onChangeText={setNewPercent}
            placeholder="0–100"
          />
          <VybeButton
            title="Add / upsert"
            variant="outline"
            size="md"
            style={{ marginTop: 12 }}
            loading={saving === 'pc:new'}
            onPress={addPlatformRule}
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Per-store commission</Text>
        <Text style={styles.hintSmall}>
          Leave empty and tap Save to use the category default for that store.
        </Text>
        {stores.map((s) => (
          <View key={s.id} style={styles.card}>
            <Text style={styles.storeName}>{s.name}</Text>
            {s.commissionPercentOverride != null && (
              <Text style={styles.meta}>Custom rate: {s.commissionPercentOverride}%</Text>
            )}
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="% for this store"
                value={storeEdits[s.id] ?? ''}
                onChangeText={(t) => setStoreEdits((prev) => ({ ...prev, [s.id]: t }))}
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => saveStoreCommission(s.id)}
                disabled={saving === `st:${s.id}`}
              >
                {saving === `st:${s.id}` ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {stores.length === 0 && (
          <Text style={styles.empty}>No approved stores.</Text>
        )}
      </ScrollView>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  hint: {
    fontSize: 13,
    color: tokens.slate500,
    lineHeight: 18,
    marginBottom: 16,
  },
  hintSmall: {
    fontSize: 12,
    color: tokens.slate400,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.slate800,
    marginBottom: 10,
  },
  card: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusCard,
    padding: 12,
    marginBottom: 10,
    ...tokens.shadowSoft,
  },
  addCard: { marginTop: 4 },
  slug: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800,
    marginBottom: 8,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.slate800,
    marginBottom: 4,
  },
  meta: { fontSize: 12, color: tokens.slate500, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.slate800,
  },
  inputFull: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.slate800,
    marginTop: 4,
  },
  subLabel: { fontSize: 12, fontWeight: '600', color: tokens.slate600 },
  saveBtn: {
    backgroundColor: tokens.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { fontSize: 14, color: tokens.slate500, marginBottom: 12 },
});
