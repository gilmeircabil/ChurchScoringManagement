import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '../utils/haptics';
import { COLORS } from '../constants/colors';
import { logError } from '../utils/logger';
import { getGroupColor } from '../utils/groupColors';

interface GroupItemsModalProps {
  visible: boolean;
  groupNumber: number;
  groupId: string;
  groupName?: string | null;
  quizScore: number;
  initialBookCount: number;
  initialPenCount: number;
  initialPaperCount: number;
  initialBibleCount?: number;
  initialBookPoints: number;
  initialPenPoints: number;
  initialPaperPoints: number;
  initialBiblePoints?: number;
  initialBookName?: string;
  initialPenName?: string;
  initialPaperName?: string;
  initialBibleName?: string;
  isLocked?: boolean;
  onSave: (data: {
    name?: string | null;
    book_count: number;
    pen_count: number;
    paper_count: number;
    bible_count: number;
    book_points: number;
    pen_points: number;
    paper_points: number;
    bible_points: number;
    book_name: string;
    pen_name: string;
    paper_name: string;
    bible_name: string;
    applyToAllGroups: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

export const GroupItemsModal: React.FC<GroupItemsModalProps> = ({
  visible,
  groupNumber,
  groupName,
  quizScore,
  initialBookCount,
  initialPenCount,
  initialPaperCount,
  initialBibleCount,
  initialBookPoints,
  initialPenPoints,
  initialPaperPoints,
  initialBiblePoints,
  initialBookName,
  initialPenName,
  initialPaperName,
  initialBibleName,
  isLocked = false,
  onSave,
  onClose,
}) => {
  // Custom Group Name (optional)
  const [customGroupName, setCustomGroupName] = useState(groupName || '');

  // Counts
  const [bookCount, setBookCount] = useState(String(initialBookCount ?? 0));
  const [penCount, setPenCount] = useState(String(initialPenCount ?? 0));
  const [paperCount, setPaperCount] = useState(String(initialPaperCount ?? 0));
  const [bibleCount, setBibleCount] = useState(String(initialBibleCount ?? 0));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCustomGroupName(groupName || '');
      setBookCount(String(initialBookCount ?? 0));
      setPenCount(String(initialPenCount ?? 0));
      setPaperCount(String(initialPaperCount ?? 0));
      setBibleCount(String(initialBibleCount ?? 0));
      setSaving(false);
    }
  }, [
    visible,
    groupName,
    initialBookCount,
    initialPenCount,
    initialPaperCount,
    initialBibleCount,
  ]);

  const cleanBookName = initialBookName?.trim() || 'Book';
  const cleanPenName = initialPenName?.trim() || 'Pen';
  const cleanPaperName = initialPaperName?.trim() || 'Paper';
  const cleanBibleName = initialBibleName?.trim() || 'Bible';

  const numBookPts = typeof initialBookPoints === 'number' ? initialBookPoints : 10;
  const numPenPts = typeof initialPenPoints === 'number' ? initialPenPoints : 5;
  const numPaperPts = typeof initialPaperPoints === 'number' ? initialPaperPoints : 5;
  const numBiblePts = typeof initialBiblePoints === 'number' ? initialBiblePoints : 5;

  const numBookCount = Math.max(0, parseInt(bookCount, 10) || 0);
  const numPenCount = Math.max(0, parseInt(penCount, 10) || 0);
  const numPaperCount = Math.max(0, parseInt(paperCount, 10) || 0);
  const numBibleCount = Math.max(0, parseInt(bibleCount, 10) || 0);

  const bookSubtotal = numBookCount * numBookPts;
  const penSubtotal = numPenCount * numPenPts;
  const paperSubtotal = numPaperCount * numPaperPts;
  const bibleSubtotal = numBibleCount * numBiblePts;
  const itemsBonusTotal = bookSubtotal + penSubtotal + paperSubtotal + bibleSubtotal;
  const totalGroupScore = quizScore + itemsBonusTotal;

  const groupColor = getGroupColor(groupNumber, groupName);
  const defaultColorName = groupColor.name;
  const displayGroupName = customGroupName.trim() && !/^group\s*\d+$/i.test(customGroupName.trim())
    ? customGroupName.trim()
    : defaultColorName;

  const handleAdjustCount = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    current: number,
    delta: number
  ) => {
    if (isLocked) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const next = Math.max(0, current + delta);
    setter(String(next));
  };

  const handleSave = async () => {
    if (isLocked) return;
    setSaving(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await onSave({
        name: customGroupName.trim() || null,
        book_count: numBookCount,
        pen_count: numPenCount,
        paper_count: numPaperCount,
        bible_count: numBibleCount,
        book_points: numBookPts,
        pen_points: numPenPts,
        paper_points: numPaperPts,
        bible_points: numBiblePts,
        book_name: cleanBookName,
        pen_name: cleanPenName,
        paper_name: cleanPaperName,
        bible_name: cleanBibleName,
        applyToAllGroups: false,
      });
      onClose();
    } catch (err) {
      logError('Failed to save group items bonus:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.groupColorDot, { backgroundColor: groupColor.hex }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {displayGroupName}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* Optional Group Custom Name */}
            {!isLocked && (
              <View style={styles.groupNameField}>
                <Text style={styles.drawerFieldLabel}>Group Name (Optional)</Text>
                <TextInput
                  style={styles.drawerNameInput}
                  value={customGroupName}
                  onChangeText={setCustomGroupName}
                  placeholder={`e.g. Team David (Default: ${defaultColorName})`}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            )}

            {/* 3 ITEMS INPUT SECTION */}
            <View style={styles.itemsContainer}>
              {/* ITEM 1 */}
              <View style={styles.itemCard}>
                <View style={styles.itemIconCircle}>
                  <Ionicons name="book" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{cleanBookName} Carry</Text>
                  <Text style={styles.itemSubtitle}>+{numBookPts} pts each</Text>
                </View>

                <View style={styles.counterRow}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setBookCount, numBookCount, -1)}
                    disabled={isLocked || numBookCount <= 0}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.counterInput}
                    value={bookCount}
                    onChangeText={setBookCount}
                    keyboardType="number-pad"
                    editable={!isLocked}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setBookCount, numBookCount, 1)}
                    disabled={isLocked}
                  >
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.subtotalBox}>
                  <Text style={styles.subtotalText}>+{bookSubtotal}</Text>
                  <Text style={styles.subtotalUnit}>pts</Text>
                </View>
              </View>

              {/* ITEM 2 */}
              <View style={styles.itemCard}>
                <View style={[styles.itemIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="create" size={20} color="#7C3AED" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{cleanPenName} Carry</Text>
                  <Text style={styles.itemSubtitle}>+{numPenPts} pts each</Text>
                </View>

                <View style={styles.counterRow}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setPenCount, numPenCount, -1)}
                    disabled={isLocked || numPenCount <= 0}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.counterInput}
                    value={penCount}
                    onChangeText={setPenCount}
                    keyboardType="number-pad"
                    editable={!isLocked}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setPenCount, numPenCount, 1)}
                    disabled={isLocked}
                  >
                    <Ionicons name="add" size={16} color="#7C3AED" />
                  </TouchableOpacity>
                </View>

                <View style={styles.subtotalBox}>
                  <Text style={[styles.subtotalText, { color: '#7C3AED' }]}>+{penSubtotal}</Text>
                  <Text style={styles.subtotalUnit}>pts</Text>
                </View>
              </View>

              {/* ITEM 3 */}
              <View style={styles.itemCard}>
                <View style={[styles.itemIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="document-text" size={20} color="#D97706" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{cleanPaperName} Carry</Text>
                  <Text style={styles.itemSubtitle}>+{numPaperPts} pts each</Text>
                </View>

                <View style={styles.counterRow}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setPaperCount, numPaperCount, -1)}
                    disabled={isLocked || numPaperCount <= 0}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.counterInput}
                    value={paperCount}
                    onChangeText={setPaperCount}
                    keyboardType="number-pad"
                    editable={!isLocked}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setPaperCount, numPaperCount, 1)}
                    disabled={isLocked}
                  >
                    <Ionicons name="add" size={16} color="#D97706" />
                  </TouchableOpacity>
                </View>

                <View style={styles.subtotalBox}>
                  <Text style={[styles.subtotalText, { color: '#D97706' }]}>+{paperSubtotal}</Text>
                  <Text style={styles.subtotalUnit}>pts</Text>
                </View>
              </View>

              {/* ITEM 4 */}
              <View style={styles.itemCard}>
                <View style={[styles.itemIconCircle, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="bookmarks" size={20} color="#059669" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{cleanBibleName} Carry</Text>
                  <Text style={styles.itemSubtitle}>+{numBiblePts} pts each</Text>
                </View>

                <View style={styles.counterRow}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setBibleCount, numBibleCount, -1)}
                    disabled={isLocked || numBibleCount <= 0}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.counterInput}
                    value={bibleCount}
                    onChangeText={setBibleCount}
                    keyboardType="number-pad"
                    editable={!isLocked}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => handleAdjustCount(setBibleCount, numBibleCount, 1)}
                    disabled={isLocked}
                  >
                    <Ionicons name="add" size={16} color="#059669" />
                  </TouchableOpacity>
                </View>

                <View style={styles.subtotalBox}>
                  <Text style={[styles.subtotalText, { color: '#059669' }]}>+{bibleSubtotal}</Text>
                  <Text style={styles.subtotalUnit}>pts</Text>
                </View>
              </View>
            </View>

            {/* LIVE AUTO TOTAL SUMMARY CARD */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTotalRow}>
                <View>
                  <Text style={styles.totalLabel}>TOTAL GROUP SCORE</Text>
                  <Text style={styles.totalSubtext}>Quiz + Items Bonus</Text>
                </View>
                <View style={styles.totalScoreBadge}>
                  <Text style={styles.totalScoreValue}>{totalGroupScore}</Text>
                  <Text style={styles.totalScoreUnit}>pts</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelBtnText}>{isLocked ? 'Close' : 'Cancel'}</Text>
            </TouchableOpacity>

            {!isLocked && (
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtnGradient}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Saving...' : 'Save Items'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  groupColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceVariant,
  },
  bodyScroll: {
    flexGrow: 0,
    maxHeight: 460,
  },

  groupNameField: {
    marginBottom: 10,
  },
  drawerFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  drawerNameInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingHorizontal: 2,
    marginRight: 10,
  },
  counterBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterInput: {
    width: 38,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  subtotalBox: {
    minWidth: 46,
    alignItems: 'flex-end',
  },
  subtotalText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  subtotalUnit: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    marginBottom: 8,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  totalSubtext: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  totalScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  totalScoreValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  totalScoreUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
