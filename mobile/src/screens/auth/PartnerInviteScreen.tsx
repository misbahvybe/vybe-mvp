import React, { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { useAuthStore } from '@store/auth';
import { tokens } from '@theme/tokens';

export function PartnerInviteScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const setSession = useAuthStore((s) => s.setSession);
  const paramToken = route.params?.token as string | undefined;
  const [token, setToken] = useState<string | undefined>(paramToken);

  useEffect(() => {
    if (paramToken) setToken(paramToken);
  }, [paramToken]);

  useEffect(() => {
    if (token) return;
    const fromUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const q = parsed.queryParams?.token;
      if (typeof q === 'string' && q) setToken(q);
    };
    Linking.getInitialURL().then(fromUrl);
    const sub = Linking.addEventListener('url', (e) => fromUrl(e.url));
    return () => sub.remove();
  }, [token]);

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    api
      .post<{ valid: boolean; name?: string }>('/auth/validate-invite', { token })
      .then((res) => {
        if (res.data?.valid) {
          setStatus('valid');
          setUserName(res.data.name ?? '');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const submit = async () => {
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<{
        access_token: string;
        user: { id: string; name: string; phone: string; email?: string | null; role: string };
      }>('/auth/set-password', { token, password, confirmPassword });
      setSession(data.access_token, data.user as any);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to set password';
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.centerDark}>
        <ActivityIndicator color="#a78bfa" size="large" />
      </View>
    );
  }

  if (status === 'invalid') {
    return (
      <View style={styles.centerDark}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Invalid or expired</Text>
          <Text style={styles.cardBody}>
            This invitation link is invalid or has expired. Contact your admin for a new link.
          </Text>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnOutlineText}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rootDark}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Set your password</Text>
        {userName ? <Text style={styles.welcome}>Welcome, {userName}</Text> : null}
        <View style={styles.card}>
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 8 characters, upper, lower, number"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat password"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={() => {
              submit().catch(() => {});
            }}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Activate account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootDark: { flex: 1, backgroundColor: '#0f172a' },
  centerDark: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scroll: { padding: 24, paddingTop: 48 },
  headline: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  welcome: { fontSize: 15, color: '#94a3b8', marginBottom: 20 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  cardBody: { fontSize: 14, color: '#94a3b8', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  err: { color: '#fca5a5', marginBottom: 12, fontSize: 13 },
  btn: {
    backgroundColor: tokens.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnOutlineText: { color: '#e2e8f0', fontWeight: '600' },
});
