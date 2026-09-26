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
import { COLORS } from '../constants/colors';
import { formatPlayerIdentifier } from '../utils/formatters';
import { validateScore } from '../utils/validation';

interface ScoreModalProps {
  visible: boolean;
  playerName: string;
  playerNumber: number;
  currentScore: number;
  onSave: (points: number) => void;
  onClose: () => void;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  visible,
  playerName,
  playerNumber,
  currentScore,
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
    setPointsText(String(Math.max(0, current + amount)));
    setErrorMessage(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialog}>
          <Text style={styles.title}>Enter Round Score</Text>

          <View style={styles.playerInfoRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {playerName}
            </Text>
            <View style={styles.idBadge}>
              <Text style={styles.idText}>{formatPlayerIdentifier(playerNumber)}</Text>
            </View>
          </View>

          <Text style={styles.label}>Points</Text>
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

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          {/* Quick presets for speed during live game */}
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
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
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
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerContainer,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  presetButton: {
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: 46,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onPrimaryContainer,
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
