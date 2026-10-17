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
import * as Haptics from '../utils/haptics';
import { COLORS } from '../constants/colors';
import { PlayerIdBadge } from './PlayerIdBadge';
import { getGroupColor } from '../utils/groupColors';

interface IndividualBonusModalProps {
  visible: boolean;
  playerName: string;
  playerNumber: number;
  groupName?: string | null;
  groupNumber?: number;
  groupCarryScore: number;
  initialBonus: number;
  onSave: (bonusPoints: number) => void;
  onClose: () => void;
}

export const IndividualBonusModal: React.FC<IndividualBonusModalProps> = ({
  visible,
  playerName,
  playerNumber,
  groupName,
  groupNumber,
  groupCarryScore,
  initialBonus,
  onSave,
  onClose,
}) => {
  const [bonusText, setBonusText] = useState(String(initialBonus || '0'));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBonusText(String(initialBonus ?? 0));
      setErrorMessage(null);
    }
  }, [visible, initialBonus]);

  const groupColor = groupNumber ? getGroupColor(groupNumber, groupName) : null;
  const parsedBonus = Math.max(0, parseInt(bonusText.trim() === '' ? '0' : bonusText, 10) || 0);
  const totalPlayerScore = groupCarryScore + parsedBonus;

  const handleSave = () => {
    if (parsedBonus < 0 || parsedBonus > 100000) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setErrorMessage('Please enter a valid bonus point amount (0 to 100,000).');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSave(parsedBonus);
  };

  const handleQuickAdd = (amount: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const nextVal = Math.max(0, parsedBonus + amount);
    setBonusText(String(nextVal));
    setErrorMessage(null);
  };

  const handleReset = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setBonusText('0');
    setErrorMessage(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Individual Bonus</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Player & Group Info Card */}
          <View style={styles.playerInfoCard}>
            <View style={styles.playerRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.playerNameText} numberOfLines={1}>
                    {playerName}
                  </Text>
                  <PlayerIdBadge playerNumber={playerNumber} />
                </View>
                {groupNumber && (
                  <View style={styles.groupChip}>
                    {groupColor && (
                      <View style={[styles.groupDot, { backgroundColor: groupColor.hex }]} />
                    )}
                    <Text style={styles.groupChipText}>
                      Group {groupNumber}{groupName ? ` • ${groupName}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Score Comparison row */}
            <View style={styles.scoreBreakdownContainer}>
              <View style={styles.breakdownBox}>
                <Text style={styles.breakdownLabel}>Group Carry</Text>
                <Text style={styles.breakdownValue}>{groupCarryScore} pts</Text>
              </View>
              <Ionicons name="add" size={14} color={COLORS.textMuted} />
              <View style={styles.breakdownBox}>
                <Text style={styles.breakdownLabel}>Bonus</Text>
                <Text style={[styles.breakdownValue, { color: parsedBonus > 0 ? '#10B981' : COLORS.textPrimary }]}>
                  +{parsedBonus} pts
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} />
              <View style={[styles.breakdownBox, styles.breakdownBoxTotal]}>
                <Text style={styles.breakdownLabelTotal}>Total Score</Text>
                <Text style={styles.breakdownValueTotal}>{totalPlayerScore} pts</Text>
              </View>
            </View>
          </View>

          {/* Input field */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Bonus Points</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="star-outline" size={20} color="#F59E0B" style={styles.inputIcon} />
              <TextInput
                style={styles.pointsInput}
                value={bonusText}
                onChangeText={(text) => {
                  setBonusText(text.replace(/[^0-9]/g, ''));
                  setErrorMessage(null);
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                selectTextOnFocus
              />
              <Text style={styles.ptsUnit}>pts</Text>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            {/* Quick Add Chips */}
            <View style={styles.quickAddRow}>
              {[5, 10, 15, 20].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickChip}
                  onPress={() => handleQuickAdd(amt)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickChipText}>+{amt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.quickChip, styles.resetChip]}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <Text style={styles.resetChipText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85}>
              <LinearGradient
                colors={[COLORS.primary, '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveButtonText}>Save Bonus</Text>
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
    maxWidth: 440,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceVariant,
  },
  playerInfoCard: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  groupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  groupChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  scoreBreakdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDark,
  },
  breakdownBox: {
    alignItems: 'center',
    flex: 1,
  },
  breakdownBoxTotal: {
    backgroundColor: COLORS.surface,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  breakdownLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  breakdownLabelTotal: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  breakdownValueTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  inputSection: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  pointsInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  ptsUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  resetChip: {
    backgroundColor: 'transparent',
    borderColor: COLORS.borderDark,
  },
  resetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  saveButton: {
    flex: 1.4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
