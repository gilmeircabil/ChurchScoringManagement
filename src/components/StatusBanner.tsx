import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

export type StatusMessage = { type: 'success' | 'error'; text: string } | null;

interface StatusBannerProps {
  message: StatusMessage;
  style?: object;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ message, style }) => {
  if (!message) return null;

  const isSuccess = message.type === 'success';

  return (
    <View style={[styles.banner, isSuccess ? styles.success : styles.error, style]}>
      <Ionicons
        name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={isSuccess ? COLORS.success : COLORS.danger}
        style={{ marginRight: 8 }}
      />
      <Text style={[styles.text, isSuccess ? styles.successText : styles.errorText]}>
        {message.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  success: {
    backgroundColor: COLORS.successContainer,
  },
  error: {
    backgroundColor: COLORS.dangerContainer,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  successText: {
    color: COLORS.onSuccessContainer,
  },
  errorText: {
    color: COLORS.onDangerContainer,
  },
});
