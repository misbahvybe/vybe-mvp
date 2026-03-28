import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ListOrdered, ShoppingCart, Wallet, Menu } from 'lucide-react-native';
import { tokens } from '@theme/tokens';
import { CustomerHomeScreen } from '@screens/customer/CustomerHomeScreen';
import { CustomerSearchScreen } from '@screens/customer/CustomerSearchScreen';
import { CustomerCategoryScreen } from '@screens/customer/CustomerCategoryScreen';
import { CustomerStoresScreen } from '@screens/customer/CustomerStoresScreen';
import { CustomerStoreDetailScreen } from '@screens/customer/CustomerStoreDetailScreen';
import { CustomerCartScreen } from '@screens/customer/CustomerCartScreen';
import { CustomerCheckoutScreen } from '@screens/customer/CustomerCheckoutScreen';
import { CustomerOrdersScreen } from '@screens/customer/CustomerOrdersScreen';
import { CustomerOrderDetailScreen } from '@screens/customer/CustomerOrderDetailScreen';
import { CustomerMoreScreen } from '@screens/customer/CustomerMoreScreen';
import { CustomerProfileScreen } from '@screens/customer/CustomerProfileScreen';
import { CustomerAddressesScreen } from '@screens/customer/CustomerAddressesScreen';
import { CustomerAddressFormScreen } from '@screens/customer/CustomerAddressFormScreen';
import { CustomerWalletScreen } from '@screens/customer/CustomerWalletScreen';
import { CustomerPaymentMethodsScreen } from '@screens/customer/CustomerPaymentMethodsScreen';
import { CustomerMorePasswordScreen } from '@screens/customer/CustomerMorePasswordScreen';
import { CustomerReferScreen } from '@screens/customer/CustomerReferScreen';

export type CustomerHomeStackParamList = {
  CustomerHome: undefined;
  CustomerSearch: undefined;
  CustomerCategory: { type: string; title: string };
  CustomerStores: undefined;
  StoreDetail: { id: string; name: string };
};

export type CustomerOrdersStackParamList = {
  CustomerOrders: undefined;
  CustomerOrderDetail: { id: string };
};

export type CustomerCartStackParamList = {
  Cart: undefined;
  Checkout: undefined;
};

export type CustomerWalletStackParamList = {
  CustomerWallet: undefined;
};

export type CustomerMoreStackParamList = {
  CustomerMore: undefined;
  CustomerProfile: undefined;
  CustomerAddresses: undefined;
  CustomerAddressForm: { id?: string } | undefined;
  CustomerPaymentMethods: undefined;
  CustomerMorePassword: undefined;
  CustomerRefer: undefined;
};

export type CustomerTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  CartTab: undefined;
  WalletTab: undefined;
  MoreTab: undefined;
};

const HomeStack = createNativeStackNavigator<CustomerHomeStackParamList>();
const OrdersStack = createNativeStackNavigator<CustomerOrdersStackParamList>();
const CartStack = createNativeStackNavigator<CustomerCartStackParamList>();
const WalletStack = createNativeStackNavigator<CustomerWalletStackParamList>();
const MoreStack = createNativeStackNavigator<CustomerMoreStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

function CustomerHomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="CustomerHome" component={CustomerHomeScreen} />
      <HomeStack.Screen name="CustomerSearch" component={CustomerSearchScreen} />
      <HomeStack.Screen name="CustomerCategory" component={CustomerCategoryScreen} />
      <HomeStack.Screen name="CustomerStores" component={CustomerStoresScreen} />
      <HomeStack.Screen name="StoreDetail" component={CustomerStoreDetailScreen} />
    </HomeStack.Navigator>
  );
}

function CustomerOrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="CustomerOrders" component={CustomerOrdersScreen} />
      <OrdersStack.Screen name="CustomerOrderDetail" component={CustomerOrderDetailScreen} />
    </OrdersStack.Navigator>
  );
}

function CustomerCartStackNavigator() {
  return (
    <CartStack.Navigator screenOptions={{ headerShown: false }}>
      <CartStack.Screen name="Cart" component={CustomerCartScreen} />
      <CartStack.Screen name="Checkout" component={CustomerCheckoutScreen} />
    </CartStack.Navigator>
  );
}

function CustomerWalletStackNavigator() {
  return (
    <WalletStack.Navigator screenOptions={{ headerShown: false }}>
      <WalletStack.Screen name="CustomerWallet" component={CustomerWalletScreen} />
    </WalletStack.Navigator>
  );
}

function CustomerMoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="CustomerMore" component={CustomerMoreScreen} />
      <MoreStack.Screen name="CustomerProfile" component={CustomerProfileScreen} />
      <MoreStack.Screen name="CustomerAddresses" component={CustomerAddressesScreen} />
      <MoreStack.Screen name="CustomerAddressForm" component={CustomerAddressFormScreen} />
      <MoreStack.Screen name="CustomerPaymentMethods" component={CustomerPaymentMethodsScreen} />
      <MoreStack.Screen name="CustomerMorePassword" component={CustomerMorePasswordScreen} />
      <MoreStack.Screen name="CustomerRefer" component={CustomerReferScreen} />
    </MoreStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;

export function CustomerTabNavigator() {
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
          marginBottom: 4
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
          ...tokens.shadowSoft
        }
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={CustomerHomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={CustomerOrdersStackNavigator}
        options={{
          title: 'Order',
          tabBarIcon: ({ color }) => (
            <ListOrdered size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
          )
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CustomerCartStackNavigator}
        options={{
          title: 'My Cart',
          tabBarIcon: ({ color }) => (
            <ShoppingCart size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
          )
        }}
      />
      <Tab.Screen
        name="WalletTab"
        component={CustomerWalletStackNavigator}
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color }) => <Wallet size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={CustomerMoreStackNavigator}
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Menu size={TAB_ICON_SIZE} color={color} strokeWidth={2} />
        }}
      />
    </Tab.Navigator>
  );
}
