import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Feather';
import { useAuthStore } from '@store/auth';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { OnboardingScreen } from '@screens/auth/OnboardingScreen';
import { SignupScreen } from '@screens/auth/SignupScreen';
import { SignupOtpScreen } from '@screens/auth/SignupOtpScreen';
import { ForgotPasswordScreen } from '@screens/auth/ForgotPasswordScreen';
import { LoginOtpScreen } from '@screens/auth/LoginOtpScreen';
import { HelpScreen } from '@screens/misc/HelpScreen';
import { TermsScreen } from '@screens/misc/TermsScreen';
import { PrivacyScreen } from '@screens/misc/PrivacyScreen';
import { NotificationsScreen } from '@screens/misc/NotificationsScreen';
import { CustomerHomeScreen } from '@screens/customer/CustomerHomeScreen';
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
import { StoreDashboardScreen } from '@screens/store/StoreDashboardScreen';
import { StoreOrdersScreen } from '@screens/store/StoreOrdersScreen';
import { StoreProductsScreen } from '@screens/store/StoreProductsScreen';
import { StoreSettingsScreen } from '@screens/store/StoreSettingsScreen';
import { RiderDashboardScreen } from '@screens/rider/RiderDashboardScreen';
import { RiderOrdersScreen } from '@screens/rider/RiderOrdersScreen';
import { RiderEarningsScreen } from '@screens/rider/RiderEarningsScreen';
import { AdminDashboardScreen } from '@screens/admin/AdminDashboardScreen';

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  SignupOtp: { phone: string };
  ForgotPassword: undefined;
  LoginOtp: { phone: string };
  Help: undefined;
  Terms: undefined;
  Privacy: undefined;
  Notifications: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

type CustomerStackParamList = {
  CustomerHome: undefined;
  CustomerCategory: { type: string; title: string };
  CustomerStores: undefined;
  StoreDetail: { id: string; name: string };
  Cart: undefined;
  Checkout: undefined;
  CustomerOrders: undefined;
  CustomerOrderDetail: { id: string };
  CustomerMore: undefined;
  CustomerProfile: undefined;
  CustomerAddresses: undefined;
  CustomerAddressForm: { id?: string } | undefined;
  CustomerWallet: undefined;
  CustomerPaymentMethods: undefined;
};

const CustomerStack = createNativeStackNavigator<CustomerStackParamList>();

type StoreStackParamList = {
  StoreDashboard: undefined;
  StoreOrders: undefined;
  StoreProducts: undefined;
  StoreSettings: undefined;
};

const StoreStack = createNativeStackNavigator<StoreStackParamList>();

type RiderStackParamList = {
  RiderDashboard: undefined;
  RiderOrders: undefined;
  RiderEarnings: undefined;
};

const RiderStack = createNativeStackNavigator<RiderStackParamList>();

type TabParamList = {
  CustomerHome: undefined;
  StoreHome: undefined;
  RiderHome: undefined;
  AdminHome: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false
      }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="SignupOtp" component={SignupOtpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="LoginOtp" component={LoginOtpScreen} />
      <AuthStack.Screen name="Help" component={HelpScreen} />
      <AuthStack.Screen name="Terms" component={TermsScreen} />
      <AuthStack.Screen name="Privacy" component={PrivacyScreen} />
      <AuthStack.Screen name="Notifications" component={NotificationsScreen} />
    </AuthStack.Navigator>
  );
}

function CustomerStackNavigator() {
  return (
    <CustomerStack.Navigator
      screenOptions={{
        headerShown: false
      }}
    >
      <CustomerStack.Screen name="CustomerHome" component={CustomerHomeScreen} />
      <CustomerStack.Screen name="CustomerCategory" component={CustomerCategoryScreen} />
      <CustomerStack.Screen name="CustomerStores" component={CustomerStoresScreen} />
      <CustomerStack.Screen name="StoreDetail" component={CustomerStoreDetailScreen} />
      <CustomerStack.Screen name="Cart" component={CustomerCartScreen} />
      <CustomerStack.Screen name="Checkout" component={CustomerCheckoutScreen} />
      <CustomerStack.Screen name="CustomerOrders" component={CustomerOrdersScreen} />
      <CustomerStack.Screen name="CustomerOrderDetail" component={CustomerOrderDetailScreen} />
      <CustomerStack.Screen name="CustomerMore" component={CustomerMoreScreen} />
      <CustomerStack.Screen name="CustomerProfile" component={CustomerProfileScreen} />
      <CustomerStack.Screen name="CustomerAddresses" component={CustomerAddressesScreen} />
      <CustomerStack.Screen name="CustomerAddressForm" component={CustomerAddressFormScreen} />
      <CustomerStack.Screen name="CustomerWallet" component={CustomerWalletScreen} />
      <CustomerStack.Screen name="CustomerPaymentMethods" component={CustomerPaymentMethodsScreen} />
    </CustomerStack.Navigator>
  );
}

function StoreStackNavigator() {
  return (
    <StoreStack.Navigator
      screenOptions={{
        headerShown: false
      }}
    >
      <StoreStack.Screen name="StoreDashboard" component={StoreDashboardScreen} />
      <StoreStack.Screen name="StoreOrders" component={StoreOrdersScreen} />
      <StoreStack.Screen name="StoreProducts" component={StoreProductsScreen} />
      <StoreStack.Screen name="StoreSettings" component={StoreSettingsScreen} />
    </StoreStack.Navigator>
  );
}

function RiderStackNavigator() {
  return (
    <RiderStack.Navigator
      screenOptions={{
        headerShown: false
      }}
    >
      <RiderStack.Screen name="RiderDashboard" component={RiderDashboardScreen} />
      <RiderStack.Screen name="RiderOrders" component={RiderOrdersScreen} />
      <RiderStack.Screen name="RiderEarnings" component={RiderEarningsScreen} />
    </RiderStack.Navigator>
  );
}

function RoleTabs() {
  const { user } = useAuthStore();

  if (!user) {
    return null;
  }

  const role = user.role;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#facc15',
        tabBarStyle: { backgroundColor: '#020617' }
      }}
    >
      {role === 'CUSTOMER' && (
        <Tab.Screen
          name="CustomerHome"
          component={CustomerStackNavigator}
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} />
          }}
        />
      )}
      {role === 'STORE_OWNER' && (
        <Tab.Screen
          name="StoreHome"
          component={StoreStackNavigator}
          options={{
            title: 'Store',
            tabBarIcon: ({ color, size }) => <Icon name="briefcase" color={color} size={size} />
          }}
        />
      )}
      {role === 'RIDER' && (
        <Tab.Screen
          name="RiderHome"
          component={RiderStackNavigator}
          options={{
            title: 'Rider',
            tabBarIcon: ({ color, size }) => <Icon name="bike" color={color} size={size} />
          }}
        />
      )}
      {role === 'ADMIN' && (
        <Tab.Screen
          name="AdminHome"
          component={AdminDashboardScreen}
          options={{
            title: 'Admin',
            tabBarIcon: ({ color, size }) => <Icon name="shield" color={color} size={size} />
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user } = useAuthStore();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      ) : (
        <RootStack.Screen name="Main" component={RoleTabs} />
      )}
    </RootStack.Navigator>
  );
}

