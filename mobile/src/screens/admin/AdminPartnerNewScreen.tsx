import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

export function AdminPartnerNewScreen() {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'RIDER' | 'STORE_OWNER'>('RIDER');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ inviteLink: string }>('/admin/partners', {
        name,
        email,
        phone,
        role,
        isActive,
      });
      setInviteLink(res.data.inviteLink);
    } catch (e: any) {
      setError(String(e?.response?.data?.message ?? 'Failed to create partner'));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert('Copied', 'Invite link copied to clipboard.');
  };

  if (inviteLink) {
    return (
      <PartnerScreenShell title="Invite sent" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.success}>Partner created successfully.</Text>
          <Text style={styles.hint}>Send this link to the partner. It expires in 24 hours.</Text>
          <View style={styles.linkBox}>
            <Text selectable style={styles.linkText}>
              {inviteLink}
            </Text>
          </View>
          <VybeButton title="Copy link" variant="outline" onPress={copyLink} />
          <VybeButton
            title="Invite another"
            variant="primary"
            onPress={() => {
              setInviteLink('');
              setName('');
              setEmail('');
              setPhone('');
              setRole('RIDER');
              setIsActive(true);
            }}
            style={{ marginTop: 10 }}
          />
        </ScrollView>
      </PartnerScreenShell>
    );
  }

  return (
    <PartnerScreenShell title="Invite partner" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          autoCapitalize="words"
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="03000000000"
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>Role</Text>
        <View style={styles.roleRow}>
          {(['RIDER', 'STORE_OWNER'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, role === r && styles.roleChipOn]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextOn]}>
                {r === 'RIDER' ? 'Rider' : 'Store owner'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Active</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <VybeButton
          title="Create & get invite link"
          variant="accent"
          loading={loading}
          disabled={loading || name.length < 2 || !email || phone.length < 10}
          onPress={submit}
        />
      </ScrollView>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.slate700, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: tokens.slate800,
  },
  roleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.slate200,
    alignItems: 'center',
  },
  roleChipOn: { borderColor: tokens.accent, backgroundColor: 'rgba(250, 204, 21, 0.15)' },
  roleChipText: { fontSize: 14, fontWeight: '600', color: tokens.slate600 },
  roleChipTextOn: { color: tokens.slate900 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  err: { color: '#b91c1c', fontSize: 13, marginBottom: 8 },
  success: { fontSize: 15, fontWeight: '600', color: '#15803d', marginBottom: 8 },
  hint: { fontSize: 13, color: tokens.slate600, marginBottom: 12 },
  linkBox: {
    backgroundColor: tokens.slate100,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  linkText: { fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
});
