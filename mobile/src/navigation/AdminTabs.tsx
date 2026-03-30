import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Package,
  Store,
  Wallet,
  Menu,
} from 'lucide-react-native';
import { tokens } from '@theme/tokens';
import { AdminDashboardScreen } from '@screens/admin/AdminDashboardScreen';
import { AdminOrdersScreen } from '@screens/admin/AdminOrdersScreen';
import { PartnerOrderDetailScreen } from '@screens/partner/PartnerOrderDetailScreen';
import { AdminStoresScreen } from '@screens/admin/AdminStoresScreen';
import { AdminFinanceDetailScreen } from '@screens/admin/AdminFinanceDetailScreen';
import { AdminMoreScreen } from '@screens/admin/AdminMoreScreen';
import { AdminUsersListScreen } from '@screens/admin/AdminUsersListScreen';
import { AdminRidersListScreen } from '@screens/admin/AdminRidersListScreen';
import { AdminPartnersListScreen } from '@screens/admin/AdminPartnersListScreen';
import { AdminPartnerNewScreen } from '@screens/admin/AdminPartnerNewScreen';
import { AdminMetricsDetailScreen } from '@screens/admin/AdminMetricsDetailScreen';
import { AdminSettingsScreen } from '@screens/admin/AdminSettingsScreen';
import { AdminPricingScreen } from '@screens/admin/AdminPricingScreen';

function AdminFinanceTabScreen() {
  return <AdminFinanceDetailScreen hideBack />;
}

export type AdminDashboardStackParamList = {
  AdminDashboard: undefined;
};

export type AdminOrdersStackParamList = {
  AdminOrders: undefined;
  AdminOrderDetail: { id: string };
};

export type AdminStoresStackParamList = {
  AdminStores: undefined;
};

export type AdminFinanceStackParamList = {
  AdminFinance: undefined;
};

export type AdminMoreStackParamList = {
  AdminMoreMenu: undefined;
  AdminUsers: undefined;
  AdminRiders: undefined;
  AdminPartners: undefined;
  AdminPartnerNew: undefined;
  AdminMetrics: undefined;
  AdminPricing: undefined;
  AdminSettings: undefined;
};

export type AdminTabParamList = {
  AdminDashboardTab: undefined;
  AdminOrdersTab: undefined;
  AdminStoresTab: undefined;
  AdminFinanceTab: undefined;
  AdminMoreTab: undefined;
};

const DashboardStack = createNativeStackNavigator<AdminDashboardStackParamList>();
const OrdersStack = createNativeStackNavigator<AdminOrdersStackParamList>();
const StoresStack = createNativeStackNavigator<AdminStoresStackParamList>();
const FinanceStack = createNativeStackNavigator<AdminFinanceStackParamList>();
const MoreStack = createNativeStackNavigator<AdminMoreStackParamList>();
const Tab = createBottomTabNavigator<AdminTabParamList>();

function AdminDashboardStackNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    </DashboardStack.Navigator>
  );
}

function AdminOrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <OrdersStack.Screen name="AdminOrderDetail" component={PartnerOrderDetailScreen} />
    </OrdersStack.Navigator>
  );
}

function AdminStoresStackNavigator() {
  return (
    <StoresStack.Navigator screenOptions={{ headerShown: false }}>
      <StoresStack.Screen name="AdminStores" component={AdminStoresScreen} />
    </StoresStack.Navigator>
  );
}

function AdminFinanceStackNavigator() {
  return (
    <FinanceStack.Navigator screenOptions={{ headerShown: false }}>
      <FinanceStack.Screen name="AdminFinance" component={AdminFinanceTabScreen} />
    </FinanceStack.Navigator>
  );
}

function AdminMoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="AdminMoreMenu" component={AdminMoreScreen} />
      <MoreStack.Screen name="AdminUsers" component={AdminUsersListScreen} />
      <MoreStack.Screen name="AdminRiders" component={AdminRidersListScreen} />
      <MoreStack.Screen name="AdminPartners" component={AdminPartnersListScreen} />
      <MoreStack.Screen name="AdminPartnerNew" component={AdminPartnerNewScreen} />
      <MoreStack.Screen name="AdminMetrics" component={AdminMetricsDetailScreen} />
      <MoreStack.Screen name="AdminPricing" component={AdminPricingScreen} />
      <MoreStack.Screen name="AdminSettings" component={AdminSettingsScreen} />
    </MoreStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;

export function AdminTabNavigator() {
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
        name="AdminDashboardTab"
        component={AdminDashboardStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <LayoutDashboard size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminOrdersTab"
        component={AdminOrdersStackNavigator}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <Package size={TAB_ICON_SIZE} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="AdminStoresTab"
        component={AdminStoresStackNavigator}
        options={{
          title: 'Stores',
          tabBarIcon: ({ color }) => <Store size={TAB_ICON_SIZE} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="AdminFinanceTab"
        component={AdminFinanceStackNavigator}
        options={{
          title: 'Finance',
          tabBarIcon: ({ color }) => <Wallet size={TAB_ICON_SIZE} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="AdminMoreTab"
        component={AdminMoreStackNavigator}
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Menu size={TAB_ICON_SIZE} color={color} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
}
