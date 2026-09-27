import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      <View
        style={[
          styles.dot,
          status === 'DRAFT' && styles.dotDraft,
          status === 'ACTIVE' && styles.dotActive,
          status === 'LOCKED' && styles.dotLocked,
        ]}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeDraft: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  dotDraft: {
    backgroundColor: '#D97706',
  },
  labelDraft: {
    color: '#92400E',
  },
  badgeActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  dotActive: {
    backgroundColor: '#16A34A',
  },
  labelActive: {
    color: '#15803D',
  },
  badgeLocked: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  dotLocked: {
    backgroundColor: '#94A3B8',
  },
  labelLocked: {
    color: '#64748B',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
