import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface PendingScorePlaceholderProps {
  size?: 'sm' | 'md';
}

/**
 * Shown in place of score controls while a round is still in DRAFT,
 * where scoring is not yet allowed.
 */
export const PendingScorePlaceholder: React.FC<PendingScorePlaceholderProps> = ({ size = 'sm' }) => {
  return (
    <View
      style={[styles.badge, size === 'md' && styles.badgeMd]}
      accessibilityLabel="Scoring not available until the round starts"
    >
      <Text style={[styles.label, size === 'md' && styles.labelMd]}>—</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 30,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 34,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  labelMd: {
    fontSize: 14,
  },
});
