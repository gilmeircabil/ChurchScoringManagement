import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';
import { DEFAULT_WHEEL_ITEMS, DEFAULT_WHEEL_NAME } from '../utils/wheelStorage';

interface EditWheelModalProps {
  visible: boolean;
  wheelName: string;
  items: string[];
  onSave: (newName: string, newItems: string[]) => void;
  onClose: () => void;
}

export const EditWheelModal: React.FC<EditWheelModalProps> = ({
  visible,
  wheelName,
  items,
  onSave,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const [name, setName] = useState(wheelName);
  const [itemList, setItemList] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (visible) {
      setName(wheelName);
      setItemList([...items]);
      setNewItemText('');
    }
  }, [visible, wheelName, items]);

  const handleAddItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setItemList((prev) => [...prev, trimmed]);
    setNewItemText('');
  };

  const handleRemoveItem = (index: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setItemList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleResetTo1To10 = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setName(DEFAULT_WHEEL_NAME);
    setItemList([...DEFAULT_WHEEL_ITEMS]);
  };

  const handleSave = () => {
    if (itemList.length === 0) {
      Alert.alert('Empty Wheel', 'Please add at least one item to the wheel.');
      return;
    }

    const finalName = name.trim() || DEFAULT_WHEEL_NAME;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSave(finalName, itemList);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isTablet ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isTablet && styles.overlayTablet]}>
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Wheel</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            {/* Wheel Name */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WHEEL NAME</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Wheel Name"
                placeholderTextColor={COLORS.textMuted}
                maxLength={30}
              />
            </View>

            {/* Quick 1-10 Reset Button */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={handleResetTo1To10}
              >
                <Ionicons name="reload-outline" size={16} color={COLORS.primary} />
                <Text style={styles.presetButtonText}>Reset to 1–10 Numbers</Text>
              </TouchableOpacity>
            </View>

            {/* Add New Item */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ADD NUMBER / ITEM</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.textInput, styles.addInput]}
                  value={newItemText}
                  onChangeText={setNewItemText}
                  placeholder="Enter item..."
                  placeholderTextColor={COLORS.textMuted}
                  onSubmitEditing={handleAddItem}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addButton, !newItemText.trim() && styles.addButtonDisabled]}
                  onPress={handleAddItem}
                  disabled={!newItemText.trim()}
                >
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Items List */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ITEMS ON WHEEL ({itemList.length})</Text>
              <View style={styles.itemsListContainer}>
                {itemList.map((item, index) => (
                  <View key={`${index}-${item}`} style={styles.itemRow}>
                    <Text style={styles.itemNumber}>#{index + 1}</Text>
                    <Text style={styles.itemName} numberOfLines={1}>{item}</Text>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemoveItem(index)}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, itemList.length === 0 && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={itemList.length === 0}
            >
              <Text style={styles.saveButtonText}>Save</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  containerTablet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  closeIconButton: {
    padding: 4,
  },
  scrollArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  presetButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemsListContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    width: 32,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  deleteButton: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
