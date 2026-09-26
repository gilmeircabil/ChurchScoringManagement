import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { formatPlayerIdentifier } from '../utils/formatters';

interface PlayerIdBadgeProps {
  playerNumber: number;
  size?: 'sm' | 'md';
}

export const PlayerIdBadge: React.FC<PlayerIdBadgeProps> = ({ playerNumber, size = 'sm' }) => {
  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.label, size === 'md' && styles.labelMd]}>
        {formatPlayerIdentifier(playerNumber)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  badgeMd: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  labelMd: {
    fontSize: 12,
  },
});
