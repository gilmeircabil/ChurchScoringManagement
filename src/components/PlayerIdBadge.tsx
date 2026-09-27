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
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.18)',
    alignSelf: 'center',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  labelMd: {
    fontSize: 12,
  },
});
