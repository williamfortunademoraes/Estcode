import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { appTheme } from '@/src/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIconName) {
  return function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    const iconColor = typeof color === 'string' ? color : appTheme.colors.onSurfaceVariant;

    return <Ionicons name={name} color={iconColor} size={size} />;
  };
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appTheme.colors.primary,
        tabBarInactiveTintColor: appTheme.colors.onSurfaceVariant,
        tabBarStyle: {
          height: 70,
          paddingTop: 6,
          paddingBottom: 8,
          backgroundColor: appTheme.colors.surface,
          borderTopColor: appTheme.colors.outline,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: tabIcon('grid-outline') }}
      />
      <Tabs.Screen
        name="products"
        options={{ title: 'Produtos', tabBarIcon: tabIcon('cube-outline') }}
      />
      <Tabs.Screen
        name="scanner"
        options={{ title: 'Scanner', tabBarIcon: tabIcon('scan-outline') }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: 'Estoque', tabBarIcon: tabIcon('swap-vertical-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: tabIcon('person-outline') }}
      />
    </Tabs>
  );
}
