import React from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


export default function App() {
  return (
  <GestureHandlerRootView style={{ flex: 1 }}>
  <Text>Hello</Text>
</GestureHandlerRootView>
);
}