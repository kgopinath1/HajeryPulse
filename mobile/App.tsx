/**
 * Hajery Pulse — root component.
 *
 * Wires up:
 *  - SafeAreaProvider for status-bar / notch handling
 *  - AuthProvider — manages refresh tokens, biometric gate, and session state
 *  - NavigationContainer — switches between LoginStack and AppTabs based on auth state
 *  - Status bar styling matching the dark theme
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@auth/AuthContext';
import { RootNavigator } from '@navigation/RootNavigator';
import { theme } from '@theme/index';

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg0 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg0} />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
