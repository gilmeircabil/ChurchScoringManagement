import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const iconName = isActive ? tab.activeIcon : tab.icon;
          const color = isActive ? COLORS.primary : COLORS.textSecondary;

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButton}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  container: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    width: 36,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIconWrapper: {
    backgroundColor: COLORS.primaryContainer,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
});
