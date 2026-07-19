import { AuthProvider } from '@/auth/AuthContext';
import React from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';


export default function App() {
  return (
 <GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <AuthProvider>
      <Text>Hello</Text>
    </AuthProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
);
}