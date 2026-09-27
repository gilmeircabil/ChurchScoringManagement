import React, { useState, useEffect } from 'react';
import { BlurView } from 'expo-blur';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';
import { PlayerIdBadge } from './PlayerIdBadge';
import { validateScore } from '../utils/validation';

interface ScoreModalProps {
  visible: boolean;
  playerName?: string;
  playerNumber?: number;
  groupName?: string | null;
  groupNumber?: number;
  currentScore: number;
  title?: string;
  subtitle?: string;
  onSave: (points: number) => void;
  onClose: () => void;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  visible,
  playerName,
  playerNumber,
  groupName,
  groupNumber,
  currentScore,
  title,
  subtitle,
  onSave,
  onClose,
}) => {
  const [pointsText, setPointsText] = useState(String(currentScore || ''));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPointsText(currentScore === 0 ? '' : String(currentScore));
      setErrorMessage(null);
    }
  }, [visible, currentScore]);

  const handleSave = () => {
    const valueToValidate = pointsText.trim() === '' ? '0' : pointsText;
    const result = validateScore(valueToValidate);

    if (!result.isValid) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setErrorMessage(result.error || 'Please enter a valid number of points.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSave(result.points);
  };

  const handleQuickAdd = (amount: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const current = parseInt(pointsText, 10) || 0;
    const nextVal = Math.max(0, current + amount);
    setPointsText(nextVal === 0 ? '' : String(nextVal));
    setErrorMessage(null);
  };

  const handleSetExact = (val: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPointsText(val === 0 ? '' : String(val));
    setErrorMessage(null);
  };

  const modalTitle = title || (currentScore > 0 ? 'Edit Round Score' : 'Enter Round Score');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialog}>
          <View style={styles.headerBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{modalTitle}</Text>
              {subtitle ? <Text style={styles.subTitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              style={styles.closeIconButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {groupNumber !== undefined ? (
            <View style={styles.playerInfoRow}>
              <View style={styles.groupModalBadge}>
                <Text style={styles.groupModalBadgeText}>{groupNumber}</Text>
              </View>
              <Text style={styles.playerName} numberOfLines={1}>
                {groupName ? `GROUP ${groupNumber} — ${groupName}` : `GROUP ${groupNumber}`}
              </Text>
            </View>
          ) : playerName ? (
            <View style={styles.playerInfoRow}>
              <Text style={styles.playerName} numberOfLines={1}>
                {playerName}
              </Text>
              {playerNumber !== undefined && <PlayerIdBadge playerNumber={playerNumber} />}
            </View>
          ) : null}

          <Text style={styles.label}>Points</Text>
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.inputStepperButton}
              onPress={() => handleQuickAdd(-5)}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={styles.textInputWrapper}>
              <TextInput
                style={[styles.input, errorMessage ? styles.inputError : null]}
                value={pointsText}
                onChangeText={(text) => {
                  setPointsText(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                maxLength={6}
              />
              {pointsText.length > 0 && (
                <TouchableOpacity
                  style={styles.clearInputButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPointsText('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.inputStepperButton, styles.inputStepperButtonAdd]}
              onPress={() => handleQuickAdd(5)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          {/* Quick Add Presets */}
          <Text style={styles.presetSectionLabel}>Quick Add</Text>
          <View style={styles.presetsRow}>
            {[5, 10, 15, 20, 25].map((pts) => (
              <TouchableOpacity
                key={pts}
                style={styles.presetButton}
                onPress={() => handleQuickAdd(pts)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetText}>+{pts}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Adjust / Deduct Presets */}
          <Text style={styles.presetSectionLabel}>Quick Adjust</Text>
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonAlt]}
              onPress={() => handleQuickAdd(-5)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, styles.presetTextAlt]}>-5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonAlt]}
              onPress={() => handleQuickAdd(-10)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, styles.presetTextAlt]}>-10</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonNeutral]}
              onPress={() => handleSetExact(0)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, styles.presetTextNeutral]}>Set 0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonNeutral]}
              onPress={() => handleSetExact(10)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, styles.presetTextNeutral]}>Set 10</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonNeutral]}
              onPress={() => handleSetExact(20)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, styles.presetTextNeutral]}>Set 20</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButtonWrapper} onPress={handleSave} activeOpacity={0.85}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButton}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveButtonText}>Save Score</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupModalBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  groupModalBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  playerName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  inputStepperButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  inputStepperButtonAdd: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: 'rgba(79, 70, 229, 0.2)',
  },
  textInputWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 10,
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  clearInputButton: {
    position: 'absolute',
    right: 12,
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerContainer,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  presetSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.onPrimaryContainer,
  },
  presetButtonAlt: {
    backgroundColor: COLORS.warningContainer,
  },
  presetTextAlt: {
    color: COLORS.onWarningContainer,
  },
  presetButtonNeutral: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  presetTextNeutral: {
    color: COLORS.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  saveButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
