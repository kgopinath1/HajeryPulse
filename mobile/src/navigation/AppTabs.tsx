import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomTabBar, BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HomeScreen }              from '@screens/HomeScreen';
import { WholesaleTenderScreen } from '@screens/WholesaleTenderScreen';
import { PharmaciesScreen }       from '@screens/PharmaciesScreen';
import { FBScreen }                from '@screens/FBScreen';
import { FinanceOpsScreen }        from '@screens/FinanceOpsScreen';
import { InboxScreen }             from '@screens/InboxScreen';
import { AppTabsParamList } from './types';
import { theme } from '@theme/index';
import { useAuth } from '@auth/AuthContext';

const Tab = createBottomTabNavigator<AppTabsParamList>();

const tabIcon = (iconName: string) => ({ color, size }: { color: string; size: number }) => (
  <Ionicons name={iconName} size={22} color={color} />
);

// Demo (App Store review) account only: a strip above the tab bar so the
// generated figures are never mistaken for real ones, on every tab.
const demoTabBar = (props: BottomTabBarProps) => (
  <View>
    <View style={styles.demoBanner}>
      <Ionicons name="flask-outline" size={13} color={theme.colors.amber} />
      <Text style={styles.demoBannerText}>Sample data · demo account</Text>
    </View>
    <BottomTabBar {...props} />
  </View>
);

export function AppTabs(): React.JSX.Element {
  // Fixed height alone would sit under whatever system UI a device reserves
  // at the bottom (3-button nav bar, gesture bar, an OEM taskbar) — adding
  // the actual inset keeps the tab bar clear of it on any device, not just
  // the one it happened to look fine on during testing.
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={user?.isDemo ? demoTabBar : undefined}
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
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

     <Tab.Screen
       name="Home"
       component={HomeScreen}
       options={{
         title: 'Home',
         tabBarIcon: tabIcon('home-outline'),
       }}
     />

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

const styles = StyleSheet.create({
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    backgroundColor: theme.colors.surfaceHi,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.amber,
  },
  demoBannerText: {
    color: theme.colors.amber,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});