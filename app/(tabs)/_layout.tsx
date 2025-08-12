import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="texas-holdem"
        options={{
          title: 'Texas Holdem',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cards-playing-diamond-multiple" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="omaha"
        options={{
          title: 'Omaha',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cards-playing-diamond-multiple" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="blackjack"
        options={{
          title: 'Blackjack',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cards-playing-spade-multiple" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
