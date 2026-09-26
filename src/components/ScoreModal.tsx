import React, { useState, useEffect } from 'react';
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
import { COLORS } from '../constants/colors';
import { PlayerIdBadge } from './PlayerIdBadge';
import { validateScore } from '../utils/validation';

interface ScoreModalProps {
  visible: boolean;
  playerName: string;
  playerNumber: number;
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
      setErrorMessage(result.error || 'Please enter a valid number of points.');
      return;
    }

    onSave(result.points);
  };

  const handleQuickAdd = (amount: number) => {
    const current = parseInt(pointsText, 10) || 0;
    const nextVal = Math.max(0, current + amount);
    setPointsText(nextVal === 0 ? '' : String(nextVal));
    setErrorMessage(null);
  };

  const handleSetExact = (val: number) => {
    setPointsText(val === 0 ? '' : String(val));
    setErrorMessage(null);
  };

  const modalTitle = title || (currentScore > 0 ? 'Edit Round Score' : 'Enter Round Score');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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

          <View style={styles.playerInfoRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {playerName}
            </Text>
            <PlayerIdBadge playerNumber={playerNumber} />
          </View>

          <Text style={styles.label}>Points</Text>
          <View style={styles.inputContainer}>
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
                onPress={() => setPointsText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
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
            >
              <Text style={[styles.presetText, styles.presetTextAlt]}>-5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonAlt]}
              onPress={() => handleQuickAdd(-10)}
            >
              <Text style={[styles.presetText, styles.presetTextAlt]}>-10</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonNeutral]}
              onPress={() => handleSetExact(0)}
            >
              <Text style={[styles.presetText, styles.presetTextNeutral]}>Set 0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonNeutral]}
              onPress={() => handleSetExact(10)}
            >
              <Text style={[styles.presetText, styles.presetTextNeutral]}>Set 10</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.presetButtonNeutral]}
              onPress={() => handleSetExact(20)}
            >
              <Text style={[styles.presetText, styles.presetTextNeutral]}>Set 20</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Score</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 22,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeIconButton: {
    padding: 4,
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingHorizontal: 40,
    paddingVertical: 10,
    fontSize: 26,
    fontWeight: '700',
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
    fontWeight: '500',
    marginBottom: 6,
    textAlign: 'center',
  },
  presetSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 6,
  },
  presetButton: {
    flex: 1,
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
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
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
