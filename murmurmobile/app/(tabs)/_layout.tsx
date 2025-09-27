import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1C1C1C',
          borderTopWidth: 0, // Removes the top border line on the tab bar
        },
        tabBarActiveTintColor: '#26D0CE',
        tabBarInactiveTintColor: '#888',
      }}>
      <Tabs.Screen
        name="Listen"
      />
    </Tabs>
  );
}
