import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

interface PartnerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  isActive: boolean;
  passwordSet: boolean;
}

export function AdminPartnersListScreen() {
  const navigation = useNavigation<any>();
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PartnerRow[]>('/admin/partners')
      .then((r) => setPartners(r.data ?? []))
      .catch(() => setPartners([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PartnerScreenShell
      title="Partners"
      showBack
      onBack={() => navigation.goBack()}
      scrollable={false}
      bottomPadding="nav"
    >
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => navigation.navigate('AdminPartnerNew')}
        >
          <Text style={styles.inviteBtnText}>Invite partner</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <FlatList
            data={partners}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
            ListEmptyComponent={<Text style={styles.empty}>No partners.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.role}>
                  {item.role} · {item.isActive ? 'Active' : 'Inactive'}
                </Text>
                <Text style={styles.meta}>{item.phone}</Text>
                {item.email ? <Text style={styles.meta}>{item.email}</Text> : null}
                <Text style={styles.hint}>
                  {item.passwordSet ? 'Password set' : 'Invite pending / no password'}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  inviteBtn: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.primaryDark,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  inviteBtnText: { color: tokens.white, fontSize: 14, fontWeight: '600' },
  body: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: tokens.slate500, marginTop: 32 },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    ...tokens.shadowSoft
  },
  name: { fontSize: 15, fontWeight: '600', color: tokens.slate800 },
  role: { fontSize: 12, fontWeight: '600', color: tokens.accent, marginTop: 4 },
  meta: { fontSize: 13, color: tokens.slate500, marginTop: 4 },
  hint: { fontSize: 11, color: tokens.slate400, marginTop: 6 }
});
