import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { AppNavigator } from './src/navigation';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { OfflineOverlay } from './src/components/OfflineOverlay';

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

function App() {
  return (
    <NetworkProvider>
      <SafeAreaProvider>
        <NavigationContainer linking={linking as React.ComponentProps<typeof NavigationContainer>['linking']}>
          <AppNavigator />
          <OfflineOverlay />
          <StatusBar style="light" />
        </NavigationContainer>
      </SafeAreaProvider>
    </NetworkProvider>
  );
}

registerRootComponent(App);

