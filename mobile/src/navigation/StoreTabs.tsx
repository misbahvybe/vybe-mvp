import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, ShoppingBag, CircleDollarSign, Settings } from 'lucide-react-native';
import { tokens } from '@theme/tokens';
import { StoreEarningsScreen } from '@screens/store/StoreEarningsScreen';
import { StoreOrdersScreen } from '@screens/store/StoreOrdersScreen';
import { PartnerOrderDetailScreen } from '@screens/partner/PartnerOrderDetailScreen';
import { StoreProductsScreen } from '@screens/store/StoreProductsScreen';
import { StoreSettingsScreen } from '@screens/store/StoreSettingsScreen';

export type StoreEarningsStackParamList = {
  StoreEarnings: undefined;
};

export type StoreOrdersStackParamList = {
  StoreOrders: undefined;
  StoreOrderDetail: { id: string };
};

export type StoreProductsStackParamList = {
  StoreProducts: undefined;
};

export type StoreSettingsStackParamList = {
  StoreSettings: undefined;
};

export type StoreTabParamList = {
  StoreOrdersTab: undefined;
  StoreProductsTab: undefined;
  StoreEarningsTab: undefined;
  StoreSettingsTab: undefined;
};

const EarningsStack = createNativeStackNavigator<StoreEarningsStackParamList>();
const OrdersStack = createNativeStackNavigator<StoreOrdersStackParamList>();
const ProductsStack = createNativeStackNavigator<StoreProductsStackParamList>();
const SettingsStack = createNativeStackNavigator<StoreSettingsStackParamList>();
const Tab = createBottomTabNavigator<StoreTabParamList>();

function StoreEarningsStackNavigator() {
  return (
    <EarningsStack.Navigator screenOptions={{ headerShown: false }}>
      <EarningsStack.Screen name="StoreEarnings" component={StoreEarningsScreen} />
    </EarningsStack.Navigator>
  );
}

function StoreOrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="StoreOrders" component={StoreOrdersScreen} />
      <OrdersStack.Screen name="StoreOrderDetail" component={PartnerOrderDetailScreen} />
    </OrdersStack.Navigator>
  );
}

function StoreProductsStackNavigator() {
  return (
    <ProductsStack.Navigator screenOptions={{ headerShown: false }}>
      <ProductsStack.Screen name="StoreProducts" component={StoreProductsScreen} />
    </ProductsStack.Navigator>
  );
}

function StoreSettingsStackNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="StoreSettings" component={StoreSettingsScreen} />
    </SettingsStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;

export function StoreTabNavigator() {
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
        name="StoreOrdersTab"
        component={StoreOrdersStackNavigator}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <Package size={TAB_ICON_SIZE} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="StoreProductsTab"
        component={StoreProductsStackNavigator}
        options={{
          title: 'Products',
          tabBarIcon: ({ color }) => (
            <ShoppingBag size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="StoreEarningsTab"
        component={StoreEarningsStackNavigator}
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => (
            <CircleDollarSign size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="StoreSettingsTab"
        component={StoreSettingsStackNavigator}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={TAB_ICON_SIZE} color={color} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
}
