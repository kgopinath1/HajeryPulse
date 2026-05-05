import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { WholesaleTenderScreen } from '@screens/WholesaleTenderScreen';
import { PharmaciesScreen }       from '@screens/PharmaciesScreen';
import { FBScreen }                from '@screens/FBScreen';
import { FinanceOpsScreen }        from '@screens/FinanceOpsScreen';
import { InboxScreen }             from '@screens/InboxScreen';
import { AppTabsParamList } from './types';
import { theme } from '@theme/index';

const Tab = createBottomTabNavigator<AppTabsParamList>();

const tabIcon = (label: string) => ({ color }: { color: string }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: 10, fontWeight: '600', color }}>{label}</Text>
  </View>
);

export function AppTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingTop: 6,
        },
        tabBarActiveTintColor:   theme.colors.gold,
        tabBarInactiveTintColor: theme.colors.text2,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="WholesaleTender"
        component={WholesaleTenderScreen}
        options={{ title: 'W&T', tabBarIcon: tabIcon('W&T') }}
      />
      <Tab.Screen
        name="Pharmacies"
        component={PharmaciesScreen}
        options={{ title: 'Pharma', tabBarIcon: tabIcon('PHARMA') }}
      />
      <Tab.Screen
        name="FB"
        component={FBScreen}
        options={{ title: 'F&B', tabBarIcon: tabIcon('F&B') }}
      />
      <Tab.Screen
        name="FinanceOps"
        component={FinanceOpsScreen}
        options={{ title: 'Finance', tabBarIcon: tabIcon('FIN') }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ title: 'Inbox', tabBarIcon: tabIcon('INBOX') }}
      />
    </Tab.Navigator>
  );
}
