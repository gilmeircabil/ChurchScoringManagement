import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

interface DuplicateConfirmModalProps {
  visible: boolean;
  playerName: string;
  onConfirmAddAnother: () => void;
  onChangeName: () => void;
  onCancel: () => void;
  actionType?: 'add' | 'edit';
}

export const DuplicateConfirmModal: React.FC<DuplicateConfirmModalProps> = ({
  visible,
  playerName,
  onConfirmAddAnother,
  onChangeName,
  onCancel,
  actionType = 'add',
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <Ionicons name="information-circle-outline" size={32} color={COLORS.warning} />
          </View>

          <Text style={styles.title}>Duplicate Name</Text>

          <Text style={styles.message}>
            A player named <Text style={styles.boldText}>"{playerName}"</Text> already exists.
          </Text>

          <Text style={styles.subMessage}>
            {actionType === 'add'
              ? 'Would you like to add another player with the same name?'
              : 'Would you like to keep this duplicate name anyway? (Player ID and history will remain unchanged).'}
          </Text>

          <View style={styles.buttonStack}>
            <TouchableOpacity style={styles.primaryButton} onPress={onConfirmAddAnother}>
              <Text style={styles.primaryButtonText}>
                {actionType === 'add' ? `Add Another ${playerName}` : `Use Name "${playerName}"`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={onChangeName}>
              <Text style={styles.secondaryButtonText}>Change Name</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.warningContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  boldText: {
    fontWeight: '700',
  },
  subMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.onPrimaryContainer,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
