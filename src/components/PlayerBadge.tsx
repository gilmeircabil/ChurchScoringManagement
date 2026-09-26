import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { formatPlayerIdentifier } from '../utils/formatters';

interface PlayerBadgeProps {
  name: string;
  playerNumber: number;
  score?: number;
  highlight?: boolean;
}

export const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  name,
  playerNumber,
  score,
  highlight = false,
}) => {
  return (
    <View style={[styles.container, highlight && styles.containerHighlight]}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.idBadge}>
        <Text style={styles.idText}>{formatPlayerIdentifier(playerNumber)}</Text>
      </View>
      {score !== undefined && (
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>+{score}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  containerHighlight: {
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primaryContainer,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  idBadge: {
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  idText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  scoreBadge: {
    marginLeft: 'auto',
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
    fontVariant: ['tabular-nums'],
  },
});
