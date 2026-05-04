import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { tokens } from '@theme/tokens';

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const login = useAuthStore((s) => s.login);
  const partnerLogin = useAuthStore((s) => s.partnerLogin);
  const loading = useAuthStore((s) => s.loading);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [partnerMode, setPartnerMode] = useState(false);

  const handleLogin = async () => {
    if (!emailOrPhone || !password) return;
    try {
      if (partnerMode) {
        await partnerLogin(emailOrPhone.trim(), password);
      } else {
        await login(emailOrPhone.trim(), password);
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? 'Invalid email/phone or password';
      Alert.alert('Login failed', String(msg));
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>
          {partnerMode
            ? 'Store owner, rider, or admin (partner portal)'
            : 'Customer — email or phone and password'}
        </Text>
        <TouchableOpacity
          style={styles.modeRow}
          onPress={() => setPartnerMode(!partnerMode)}
          accessibilityRole="button"
        >
          <Text style={styles.modeText}>
            {partnerMode ? 'Switch to customer login' : 'I am store owner / rider / admin'}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="admin@vybe.pk or 03000000000"
          placeholderTextColor="#94a3b8"
          value={emailOrPhone}
          onChangeText={setEmailOrPhone}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.linkText}>Forgot password? Login with OTP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.linkText}>New here? Create an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 24
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 10
  },
  modeRow: {
    marginBottom: 14,
    paddingVertical: 8,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.primary,
    textDecorationLine: 'underline',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12
  },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: tokens.primary,
    marginTop: 4
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    fontWeight: '600',
    color: tokens.white,
    fontSize: 16
  },
  linkButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
    color: '#64748b',
  },
});

