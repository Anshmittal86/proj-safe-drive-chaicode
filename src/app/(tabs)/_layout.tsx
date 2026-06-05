import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Colors } from '../../constants/theme';

export default function TabLayout() {
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'unspecified' || !scheme ? 'dark' : scheme];
  const insets = useSafeAreaInsets();

  // Tab bar sits above the system navigation bar.
  // height = icon + label area (48px) + safe area bottom inset
  const TAB_BAR_HEIGHT = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: themeColors.textSecondary,
        tabBarStyle: {
          backgroundColor: themeColors.backgroundElement,
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: themeColors.backgroundElement,
        },
        headerTintColor: themeColors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 20,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'SafeDrive',
          tabBarLabel: 'Drive',
          tabBarIcon: ({ color }) => (
            <Svg width="22" height="22" viewBox="0 0 24 24">
              {/* Steer Wheel Icon */}
              <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" />
              <Circle cx="12" cy="12" r="2.5" fill={color} />
              <Line x1="12" y1="3" x2="12" y2="9.5" stroke={color} strokeWidth="2" />
              <Line x1="3.5" y1="15.5" x2="9.5" y2="13" stroke={color} strokeWidth="2" />
              <Line x1="20.5" y1="15.5" x2="14.5" y2="13" stroke={color} strokeWidth="2" />
            </Svg>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Activity History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => (
            <Svg width="22" height="22" viewBox="0 0 24 24">
              {/* History/Clock Icon */}
              <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" />
              <Path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
            </Svg>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Calibration & Testing',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => (
            <Svg width="22" height="22" viewBox="0 0 24 24">
              {/* Sliders Icon */}
              <Path
                d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 12h6"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          ),
        }}
      />
    </Tabs>
  );
}
