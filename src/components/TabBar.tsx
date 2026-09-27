import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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

  const tabs: { key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'players', label: 'Players', icon: 'people-outline', activeIcon: 'people' },
    { key: 'round', label: 'Round', icon: 'grid-outline', activeIcon: 'grid' },
    { key: 'reports', label: 'Reports', icon: 'trophy-outline', activeIcon: 'trophy' },
    { key: 'history', label: 'History', icon: 'time-outline', activeIcon: 'time' },
  ];

  const handleTabPress = (tabKey: MainTab) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onTabChange(tabKey);
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <BlurView intensity={85} tint="light" style={styles.blurContainer}>
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
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <Ionicons name={iconName} size={22} color={color} />
                {tab.key === 'round' && hasActiveRound && <View style={styles.badgeDot} />}
              </View>
              <Text style={[styles.label, { color, fontWeight: isActive ? '700' : '500' }]}>
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
    height: 70,
    width: '92%',
    maxWidth: 420,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    // Optional shadow (works on outer view normally, but fine here)
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(79, 70, 229, 0.12)', // primary with opacity
  },
  label: {
    fontSize: 11,
    letterSpacing: -0.1,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent, // Using Rose color
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
});
