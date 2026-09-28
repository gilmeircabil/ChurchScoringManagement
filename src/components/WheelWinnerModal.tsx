import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';

interface WheelWinnerModalProps {
  visible: boolean;
  winner: string | null;
  wheelName: string;
  remainingCount: number;
  onRemove: () => void;
  onClose: () => void;
}

export const WheelWinnerModal: React.FC<WheelWinnerModalProps> = ({
  visible,
  winner,
  onRemove,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const scaleAnim = useMemo(() => new Animated.Value(0.8), []);
  const opacityAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [visible, opacityAnim, scaleAnim]);

  if (!visible || !winner) return null;

  const handleRemove = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onRemove();
  };

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            isTablet && styles.cardTablet,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Winner Display Badge */}
          <View style={[styles.resultCircle, isTablet && styles.resultCircleTablet]}>
            <Text style={[styles.resultNumber, isTablet && styles.resultNumberTablet]}>
              {winner}
            </Text>
          </View>

          <Text style={[styles.resultLabel, isTablet && styles.resultLabelTablet]}>
            Number Chosen
          </Text>

          {/* Action Buttons: Remove or Close */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.removeButton, isTablet && styles.buttonTablet]}
              onPress={handleRemove}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={isTablet ? 20 : 18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.removeButtonText, isTablet && styles.removeButtonTextTablet]}>
                Remove
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.closeButton, isTablet && styles.buttonTablet]}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.closeButtonText, isTablet && styles.closeButtonTextTablet]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTablet: {
    maxWidth: 380,
    paddingVertical: 36,
    paddingHorizontal: 28,
    borderRadius: 28,
  },
  resultCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 3,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultCircleTablet: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    marginBottom: 16,
  },
  resultNumber: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
  },
  resultNumberTablet: {
    fontSize: 52,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 24,
    letterSpacing: 0.2,
  },
  resultLabelTablet: {
    fontSize: 16,
    marginBottom: 28,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTablet: {
    height: 52,
    borderRadius: 16,
  },
  removeButton: {
    backgroundColor: COLORS.accent,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removeButtonTextTablet: {
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: COLORS.secondaryContainer,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButtonTextTablet: {
    fontSize: 16,
  },
});
