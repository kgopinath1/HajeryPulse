import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@auth/AuthContext';
import { LoginScreen } from '@screens/LoginScreen';
import { ApprovalDetailScreen } from '@screens/ApprovalDetailScreen';
import { AppTabs } from './AppTabs';
import { RootStackParamList } from './types';
import { theme } from '@theme/index';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary:    theme.colors.gold,
    background: theme.colors.bg0,
    card:       theme.colors.surface,
    text:       theme.colors.text0,
    border:     theme.colors.border,
    notification: theme.colors.pink,
  },
};

export function RootNavigator(): React.JSX.Element {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg0 }}>
        <ActivityIndicator color={theme.colors.gold} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="AppTabs" component={AppTabs} />
            <Stack.Screen
              name="ApprovalDetail"
              component={ApprovalDetailScreen}
              options={{ headerShown: true, title: 'Approval' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
