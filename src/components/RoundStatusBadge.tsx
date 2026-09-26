import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { RoundStatus } from '../types';

interface RoundStatusBadgeProps {
  status: RoundStatus;
}

export const RoundStatusBadge: React.FC<RoundStatusBadgeProps> = ({ status }) => {
  return (
    <View
      style={[
        styles.badge,
        status === 'DRAFT' && styles.badgeDraft,
        status === 'ACTIVE' && styles.badgeActive,
        status === 'LOCKED' && styles.badgeLocked,
      ]}
    >
      <Text
        style={[
          styles.label,
          status === 'DRAFT' && styles.labelDraft,
          status === 'ACTIVE' && styles.labelActive,
          status === 'LOCKED' && styles.labelLocked,
        ]}
      >
        {status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeDraft: {
    backgroundColor: COLORS.warningContainer,
  },
  badgeActive: {
    backgroundColor: COLORS.successContainer,
  },
  badgeLocked: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  labelDraft: {
    color: COLORS.onWarningContainer,
  },
  labelActive: {
    color: COLORS.onSuccessContainer,
  },
  labelLocked: {
    color: COLORS.textSecondary,
  },
});
