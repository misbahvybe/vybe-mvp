import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { api } from '@api/client';
import { useAuthStore } from '@store/auth';

type SignupOtpRoute = RouteProp<{ SignupOtp: { phone: string } }, 'SignupOtp'>;

export function SignupOtpScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<SignupOtpRoute>();
  const { phone } = route.params ?? { phone: '' };
  const setLogin = useAuthStore((s) => s.login);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code || code.length !== 6) return;
    setLoading(true);
    try {
      const { data } = await api.post<{
        access_token: string;
        user: { id: string; name: string; phone: string; role: string };
      }>('/auth/verify-otp', { phone, code });
      // Reuse auth store token handling
      await setLogin(data.user.phone, ''); // will be ignored, but keeps single source
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Invalid or expired code';
      Alert.alert('Verification failed', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {phone}. Enter it below to complete signup.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor="#94a3b8"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Verify & continue</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Use email/phone + password instead</Text>
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
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 8,
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: 12,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontWeight: '600',
    color: '#facc15',
    fontSize: 15,
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
    color: '#64748b',
  },
});

