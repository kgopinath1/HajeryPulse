import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { WholesaleTenderScreen } from '@screens/WholesaleTenderScreen';
import { PharmaciesScreen }       from '@screens/PharmaciesScreen';
import { FBScreen }                from '@screens/FBScreen';
import { FinanceOpsScreen }        from '@screens/FinanceOpsScreen';
import { InboxScreen }             from '@screens/InboxScreen';
import { AppTabsParamList } from './types';
import { theme } from '@theme/index';
import { LoginScreen } from '@/screens/LoginScreen';

const Tab = createBottomTabNavigator<AppTabsParamList>();

const tabIcon = (iconName: string) => ({ color, size }: { color: string; size: number }) => (
  <Ionicons name={iconName} size={22} color={color} />
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
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: '600',
    },
        tabBarActiveTintColor:   theme.colors.gold,
        tabBarInactiveTintColor: theme.colors.text2,
        headerShown: false,
      }}
    >

      
     {/*  <Tab.Screen
       name="Login"
       component={LoginScreen}
       options={{
         title: 'Login',
         tabBarIcon: tabIcon('briefcase-outline'),
       }}
     /> */}

     <Tab.Screen
       name="WholesaleTender"
       component={WholesaleTenderScreen}
       options={{
         title: 'W&T',
         tabBarIcon: tabIcon('briefcase-outline'),
       }}
     />

     <Tab.Screen
       name="Pharmacies"
       component={PharmaciesScreen}
       options={{
         title: 'Pharmacy',
         tabBarIcon: tabIcon('medkit-outline'),
       }}
     />

     <Tab.Screen
       name="FB"
       component={FBScreen}
       options={{
         title: 'F&B',
         tabBarIcon: tabIcon('restaurant-outline'),
       }}
     />

     {/* <Tab.Screen
       name="FinanceOps"
       component={FinanceOpsScreen}
       options={{
         title: 'Finance',
         tabBarIcon: tabIcon('cash-outline'),
       }}
     />

     <Tab.Screen
       name="Inbox"
       component={InboxScreen}
       options={{
         title: 'Inbox',
         tabBarIcon: tabIcon('mail-outline'),
       }}
     /> */}

    </Tab.Navigator>
  );
}
