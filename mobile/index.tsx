import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { AppNavigator } from './src/navigation';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { OfflineOverlay } from './src/components/OfflineOverlay';
import { useAuthStore } from './src/store/auth';
import {
  configureNotificationChannels,
  registerPushTokenForAuthenticatedUser,
  unregisterPushToken,
} from './src/lib/pushNotifications';

const linking = {
  prefixes: [Linking.createURL(''), 'vybe://'],
  config: {
    screens: {
      Auth: {
        screens: {
          PartnerInvite: {
            path: 'invite',
            parse: {
              token: (value: string) => value ?? '',
            },
          },
        },
      },
    },
  },
};
const navigationRef = createNavigationContainerRef();

function App() {
  const token = useAuthStore((s) => s.token);
  React.useEffect(() => {
    void configureNotificationChannels();
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        return false;
      }
      // Keep app alive on root instead of terminating process.
      ToastAndroid.show('App is still running. Use Home to minimize.', ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    let registeredToken: string | null = null;
    let cancelled = false;
    if (!token) return;
    void (async () => {
      try {
        const t = await registerPushTokenForAuthenticatedUser();
        if (!cancelled) registeredToken = t;
      } catch {
        // best-effort registration
      }
    })();
    return () => {
      cancelled = true;
      void unregisterPushToken(registeredToken);
    };
  }, [token]);

  return (
    <NetworkProvider>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          linking={linking as React.ComponentProps<typeof NavigationContainer>['linking']}
        >
          <AppNavigator />
          <OfflineOverlay />
          <StatusBar style="light" />
        </NavigationContainer>
      </SafeAreaProvider>
    </NetworkProvider>
  );
}

registerRootComponent(App);

