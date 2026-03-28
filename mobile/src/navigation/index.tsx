import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { PartnerInviteScreen } from '@screens/auth/PartnerInviteScreen';
import { CustomerTabNavigator } from '@navigation/CustomerTabs';
import { StoreTabNavigator } from '@navigation/StoreTabs';
import { RiderTabNavigator } from '@navigation/RiderTabs';
import { AdminTabNavigator } from '@navigation/AdminTabs';

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
  PartnerInvite: { token?: string } | undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
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
      <AuthStack.Screen name="PartnerInvite" component={PartnerInviteScreen} />
    </AuthStack.Navigator>
  );
}

function RoleRoot() {
  const { user } = useAuthStore();

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'CUSTOMER':
      return <CustomerTabNavigator />;
    case 'STORE_OWNER':
      return <StoreTabNavigator />;
    case 'RIDER':
      return <RiderTabNavigator />;
    case 'ADMIN':
      return <AdminTabNavigator />;
    default:
      return null;
  }
}

export function AppNavigator() {
  const { user } = useAuthStore();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      ) : (
        <RootStack.Screen name="Main" component={RoleRoot} />
      )}
    </RootStack.Navigator>
  );
}
