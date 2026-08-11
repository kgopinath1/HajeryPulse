import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@auth/AuthContext';
import { LoginScreen } from '@screens/LoginScreen';
import { ApprovalDetailScreen } from '@screens/ApprovalDetailScreen';
import { ProfileScreen } from '@screens/ProfileScreen';
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
  const { user, isLoading, blocked, locked, unlock, signOut } = useAuth();
  const [unlocking, setUnlocking] = useState(false);
  const [unlockFailed, setUnlockFailed] = useState(false);

  if (blocked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg0, padding: 32 }}>
        <Text style={{ color: theme.colors.text0, fontSize: 16, textAlign: 'center' }}>
          This app can't run in this environment. Please use a standard, physical device.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg0 }}>
        <ActivityIndicator color={theme.colors.gold} size="large" />
      </View>
    );
  }

  if (user && locked) {
    const onUnlock = async () => {
      setUnlocking(true);
      try {
        const ok = await unlock();
        setUnlockFailed(!ok);
      } finally {
        setUnlocking(false);
      }
    };

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg0, padding: 32 }}>
        <Text style={{ color: theme.colors.text0, fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
          Session locked
        </Text>
        <Text style={{ color: theme.colors.text2, fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
          Unlock to continue where you left off.
        </Text>
        {unlockFailed && (
          <Text style={{ color: theme.colors.pink, fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
            Couldn't verify. Try again.
          </Text>
        )}
        <TouchableOpacity
          onPress={onUnlock}
          disabled={unlocking}
          style={{ backgroundColor: theme.colors.gold, paddingHorizontal: 32, paddingVertical: 14, borderRadius: theme.radius.lg, width: '100%', alignItems: 'center' }}
        >
          {unlocking ? (
            <ActivityIndicator color={theme.colors.bg0} />
          ) : (
            <Text style={{ color: theme.colors.bg0, fontWeight: '700', fontSize: 14, letterSpacing: 0.4 }}>Unlock</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut} style={{ marginTop: 20 }}>
          <Text style={{ color: theme.colors.text2, fontSize: 12 }}>Sign out instead</Text>
        </TouchableOpacity>
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
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: true, title: 'Profile' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}