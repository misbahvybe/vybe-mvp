import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Wallet } from 'lucide-react-native';
import { tokens } from '@theme/tokens';
import { RiderDashboardScreen } from '@screens/rider/RiderDashboardScreen';
import { RiderOrdersScreen } from '@screens/rider/RiderOrdersScreen';
import { RiderOrderDetailScreen } from '@screens/rider/RiderOrderDetailScreen';
import { RiderEarningsScreen } from '@screens/rider/RiderEarningsScreen';

export type RiderHomeStackParamList = {
  RiderDashboard: undefined;
  RiderOrders: undefined;
  RiderOrderDetail: { id: string };
};

export type RiderEarningsStackParamList = {
  RiderEarnings: undefined;
};

export type RiderTabParamList = {
  RiderHomeTab: undefined;
  RiderEarningsTab: undefined;
};

const HomeStack = createNativeStackNavigator<RiderHomeStackParamList>();
const EarningsStack = createNativeStackNavigator<RiderEarningsStackParamList>();
const Tab = createBottomTabNavigator<RiderTabParamList>();

function RiderHomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="RiderDashboard" component={RiderDashboardScreen} />
      <HomeStack.Screen name="RiderOrders" component={RiderOrdersScreen} />
      <HomeStack.Screen name="RiderOrderDetail" component={RiderOrderDetailScreen} />
    </HomeStack.Navigator>
  );
}

function RiderEarningsStackNavigator() {
  return (
    <EarningsStack.Navigator screenOptions={{ headerShown: false }}>
      <EarningsStack.Screen name="RiderEarnings" component={RiderEarningsScreen} />
    </EarningsStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;

export function RiderTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.8)',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: tokens.primaryDark,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          minHeight: 56 + bottomPad,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          ...tokens.shadowSoft,
        },
      }}
    >
      <Tab.Screen
        name="RiderHomeTab"
        component={RiderHomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <LayoutDashboard size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="RiderEarningsTab"
        component={RiderEarningsStackNavigator}
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => <Wallet size={TAB_ICON_SIZE} color={color} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
}
