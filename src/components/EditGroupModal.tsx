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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import {
  PRIMARY_COLORS,
  SECONDARY_COLORS,
  getGroupColor,
  GroupColor,
} from '../utils/groupColors';
import * as Haptics from '../utils/haptics';

interface EditGroupModalProps {
  visible: boolean;
  groupNumber: number;
  currentName?: string | null;
  onSave: (name: string | null) => void;
  onClose: () => void;
}

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  visible,
  groupNumber,
  currentName,
  onSave,
  onClose,
}) => {
  const [nameText, setNameText] = useState(currentName || '');

  useEffect(() => {
    if (visible) {
      setNameText(currentName || '');
    }
  }, [visible, currentName]);

  const activeColor = getGroupColor(groupNumber, nameText);

  const handleSelectColor = (colorName: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setNameText(colorName);
  };

  const handleSave = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSave(nameText.trim() === '' ? null : nameText.trim());
  };

  const renderColorPill = (c: GroupColor, isPrimary: boolean) => {
    const isSelected = activeColor.name.toLowerCase() === c.name.toLowerCase();
    return (
      <TouchableOpacity
        key={c.id}
        style={[
          isPrimary ? styles.primaryColorPill : styles.secondaryColorPill,
          { backgroundColor: c.lightHex, borderColor: isSelected ? c.hex : c.borderHex },
          isSelected && styles.colorPillSelected,
        ]}
        onPress={() => handleSelectColor(c.name)}
        activeOpacity={0.7}
      >
        <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
        <Text
          style={[
            styles.colorPillText,
            { color: c.textHex },
            isSelected && { fontWeight: '800' },
          ]}
          numberOfLines={1}
        >
          {c.name}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={13} color={c.textHex} style={{ marginLeft: 3 }} />
        )}
      </TouchableOpacity>
    );
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
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <View style={[styles.colorDotHeader, { backgroundColor: activeColor.hex }]} />
              <Text style={styles.title}>Edit Group</Text>
            </View>

            <TouchableOpacity style={styles.closeIconButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Group Name Input */}
          <Text style={styles.fieldLabel}>Name</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={nameText}
              onChangeText={setNameText}
              placeholder={`e.g. ${activeColor.name}`}
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              selectTextOnFocus
              maxLength={40}
            />
            {nameText.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setNameText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Primary Color Choices */}
          <Text style={styles.categoryLabel}>Primary Colors</Text>
          <View style={styles.primaryChoicesRow}>
            {PRIMARY_COLORS.map((c) => renderColorPill(c, true))}
          </View>

          {/* Secondary Color Choices */}
          <Text style={[styles.categoryLabel, { marginTop: 12 }]}>Secondary Colors</Text>
          <View style={styles.secondaryChoicesGrid}>
            {SECONDARY_COLORS.map((c) => renderColorPill(c, false))}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: activeColor.hex }]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>Save</Text>
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
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 22,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  colorDotHeader: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 14,
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  primaryChoicesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryColorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  secondaryChoicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryColorPill: {
    width: '31.3%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  colorPillSelected: {
    borderWidth: 2,
    elevation: 2,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  colorPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
