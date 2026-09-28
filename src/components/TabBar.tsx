import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MainTab } from '../types';
import { COLORS } from '../constants/colors';

interface TabBarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  hasActiveRound?: boolean;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, hasActiveRound }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const tabs: { key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'players', label: 'Players', icon: 'people-outline', activeIcon: 'people' },
    { key: 'round', label: 'Round', icon: 'grid-outline', activeIcon: 'grid' },
    { key: 'reports', label: 'Reports', icon: 'trophy-outline', activeIcon: 'trophy' },
    { key: 'history', label: 'History', icon: 'time-outline', activeIcon: 'time' },
    { key: 'wheel', label: 'Wheel', icon: 'aperture-outline', activeIcon: 'aperture' },
  ];

  const handleTabPress = (tabKey: MainTab) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onTabChange(tabKey);
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <BlurView
        intensity={85}
        tint="light"
        style={[styles.blurContainer, isTablet && styles.blurContainerTablet]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const iconName = isActive ? tab.activeIcon : tab.icon;
          const color = isActive ? COLORS.primary : COLORS.textSecondary;

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButton}
              onPress={() => handleTabPress(tab.key)}
              activeOpacity={0.6}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <View
                style={[
                  styles.iconWrapper,
                  isTablet && styles.iconWrapperTablet,
                  isActive && styles.activeIconWrapper,
                ]}
              >
                <Ionicons name={iconName} size={isTablet ? 22 : 20} color={color} />
                {tab.key === 'round' && hasActiveRound && <View style={styles.badgeDot} />}
              </View>
              <Text
                style={[
                  styles.label,
                  isTablet && styles.labelTablet,
                  { color, fontWeight: isActive ? '700' : '500' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  blurContainer: {
    flexDirection: 'row',
    height: 68,
    width: '95%',
    maxWidth: 450,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  blurContainerTablet: {
    height: 72,
    maxWidth: 580,
    borderRadius: 36,
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    width: 42,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 2,
  },
  iconWrapperTablet: {
    width: 50,
    height: 32,
    borderRadius: 16,
    marginBottom: 3,
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  label: {
    fontSize: 10,
    letterSpacing: -0.2,
  },
  labelTablet: {
    fontSize: 11,
    letterSpacing: -0.1,
  },
  badgeDot: {
    position: 'absolute',
    top: 1,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
});
