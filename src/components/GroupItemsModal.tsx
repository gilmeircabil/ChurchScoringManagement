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
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';

interface GroupItemsModalProps {
  visible: boolean;
  groupNumber: number;
  groupId: string;
  groupName?: string | null;
  quizScore: number;
  initialBookCount: number;
  initialPenCount: number;
  initialPaperCount: number;
  initialBookPoints: number;
  initialPenPoints: number;
  initialPaperPoints: number;
  initialBookName?: string;
  initialPenName?: string;
  initialPaperName?: string;
  isLocked?: boolean;
  onSave: (data: {
    name?: string | null;
    book_count: number;
    pen_count: number;
    paper_count: number;
    book_points: number;
    pen_points: number;
    paper_points: number;
    book_name: string;
    pen_name: string;
    paper_name: string;
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
  initialBookPoints,
  initialPenPoints,
  initialPaperPoints,
  initialBookName,
  initialPenName,
  initialPaperName,
  isLocked = false,
  onSave,
  onClose,
}) => {
  // Custom Group Name (optional)
  const [customGroupName, setCustomGroupName] = useState(groupName || '');

  // Item Names (editable)
  const [bookName, setBookName] = useState(initialBookName || 'Book');
  const [penName, setPenName] = useState(initialPenName || 'Pen');
  const [paperName, setPaperName] = useState(initialPaperName || 'Paper');

  // Counts
  const [bookCount, setBookCount] = useState(String(initialBookCount ?? 0));
  const [penCount, setPenCount] = useState(String(initialPenCount ?? 0));
  const [paperCount, setPaperCount] = useState(String(initialPaperCount ?? 0));

  // Point values (editable)
  const [bookPoints, setBookPoints] = useState(String(initialBookPoints ?? 10));
  const [penPoints, setPenPoints] = useState(String(initialPenPoints ?? 5));
  const [paperPoints, setPaperPoints] = useState(String(initialPaperPoints ?? 5));

  // Toggle for editing item rules / point values
  const [showEditRules, setShowEditRules] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCustomGroupName(groupName || '');
      setBookName(initialBookName || 'Book');
      setPenName(initialPenName || 'Pen');
      setPaperName(initialPaperName || 'Paper');
      setBookCount(String(initialBookCount ?? 0));
      setPenCount(String(initialPenCount ?? 0));
      setPaperCount(String(initialPaperCount ?? 0));
      setBookPoints(String(initialBookPoints ?? 10));
      setPenPoints(String(initialPenPoints ?? 5));
      setPaperPoints(String(initialPaperPoints ?? 5));
      setShowEditRules(false);
      setSaving(false);
    }
  }, [
    visible,
    groupName,
    initialBookName,
    initialPenName,
    initialPaperName,
    initialBookCount,
    initialPenCount,
    initialPaperCount,
    initialBookPoints,
    initialPenPoints,
    initialPaperPoints,
  ]);

  const cleanBookName = bookName.trim() || 'Book';
  const cleanPenName = penName.trim() || 'Pen';
  const cleanPaperName = paperName.trim() || 'Paper';

  const numBookCount = Math.max(0, parseInt(bookCount, 10) || 0);
  const numPenCount = Math.max(0, parseInt(penCount, 10) || 0);
  const numPaperCount = Math.max(0, parseInt(paperCount, 10) || 0);

  const numBookPts = Math.max(0, parseInt(bookPoints, 10) || 0);
  const numPenPts = Math.max(0, parseInt(penPoints, 10) || 0);
  const numPaperPts = Math.max(0, parseInt(paperPoints, 10) || 0);

  const bookSubtotal = numBookCount * numBookPts;
  const penSubtotal = numPenCount * numPenPts;
  const paperSubtotal = numPaperCount * numPaperPts;
  const itemsBonusTotal = bookSubtotal + penSubtotal + paperSubtotal;
  const totalGroupScore = quizScore + itemsBonusTotal;

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
        book_points: numBookPts,
        pen_points: numPenPts,
        paper_points: numPaperPts,
        book_name: cleanBookName,
        pen_name: cleanPenName,
        paper_name: cleanPaperName,
        applyToAllGroups: applyToAll,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save group items bonus:', err);
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
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>G{groupNumber}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  Group {groupNumber}{customGroupName.trim() ? ` — ${customGroupName.trim()}` : ''}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  Auto-total {cleanBookName}, {cleanPenName}, and {cleanPaperName} carry points
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* Points & Rules Configuration Bar */}
            <View style={styles.pointsConfigBar}>
              <View style={styles.pointsConfigSummary}>
                <Ionicons name="pricetag-outline" size={15} color={COLORS.primary} />
                <Text style={styles.pointsConfigSummaryText} numberOfLines={1}>
                  Rules: {cleanBookName} ({numBookPts} pts) • {cleanPenName} ({numPenPts} pts) • {cleanPaperName} ({numPaperPts} pts)
                </Text>
              </View>
              {!isLocked && (
                <TouchableOpacity
                  style={styles.toggleEditPointsButton}
                  onPress={() => setShowEditRules(!showEditRules)}
                >
                  <Text style={styles.toggleEditPointsText}>
                    {showEditRules ? 'Done' : 'Edit Rules'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Editable Rules & Names Drawer */}
            {showEditRules && !isLocked && (
              <View style={styles.editPointsDrawer}>
                {/* Optional Group Custom Name */}
                <View style={styles.groupNameField}>
                  <Text style={styles.drawerFieldLabel}>🏷️ Group Name (Optional)</Text>
                  <TextInput
                    style={styles.drawerNameInput}
                    value={customGroupName}
                    onChangeText={setCustomGroupName}
                    placeholder={`e.g. Team David (Default: Group ${groupNumber})`}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                <Text style={[styles.drawerTitle, { marginTop: 10 }]}>Item Names & Points Per Item:</Text>
                <View style={styles.rulesList}>
                  {/* Item 1 */}
                  <View style={styles.ruleItemCard}>
                    <Text style={styles.ruleItemHeader}>Item 1 (Default: Book)</Text>
                    <View style={styles.ruleItemRow}>
                      <View style={{ flex: 1.6, marginRight: 8 }}>
                        <Text style={styles.ruleSubLabel}>Name</Text>
                        <TextInput
                          style={styles.ruleTextInput}
                          value={bookName}
                          onChangeText={setBookName}
                          placeholder="Book"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleSubLabel}>Points Each</Text>
                        <TextInput
                          style={styles.rulePointsInput}
                          value={bookPoints}
                          onChangeText={setBookPoints}
                          keyboardType="number-pad"
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                  </View>

                  {/* Item 2 */}
                  <View style={styles.ruleItemCard}>
                    <Text style={styles.ruleItemHeader}>Item 2 (Default: Pen)</Text>
                    <View style={styles.ruleItemRow}>
                      <View style={{ flex: 1.6, marginRight: 8 }}>
                        <Text style={styles.ruleSubLabel}>Name</Text>
                        <TextInput
                          style={styles.ruleTextInput}
                          value={penName}
                          onChangeText={setPenName}
                          placeholder="Pen"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleSubLabel}>Points Each</Text>
                        <TextInput
                          style={styles.rulePointsInput}
                          value={penPoints}
                          onChangeText={setPenPoints}
                          keyboardType="number-pad"
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                  </View>

                  {/* Item 3 */}
                  <View style={styles.ruleItemCard}>
                    <Text style={styles.ruleItemHeader}>Item 3 (Default: Paper)</Text>
                    <View style={styles.ruleItemRow}>
                      <View style={{ flex: 1.6, marginRight: 8 }}>
                        <Text style={styles.ruleSubLabel}>Name</Text>
                        <TextInput
                          style={styles.ruleTextInput}
                          value={paperName}
                          onChangeText={setPaperName}
                          placeholder="Paper"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleSubLabel}>Points Each</Text>
                        <TextInput
                          style={styles.rulePointsInput}
                          value={paperPoints}
                          onChangeText={setPaperPoints}
                          keyboardType="number-pad"
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setApplyToAll(!applyToAll)}
                >
                  <Ionicons
                    name={applyToAll ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.checkboxLabel}>
                    Apply item names & points to all groups in this round
                  </Text>
                </TouchableOpacity>
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
                    {saving ? 'Saving...' : 'Save & Update Group Score'}
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
  groupBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
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
  pointsConfigBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  pointsConfigSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  pointsConfigSummaryText: {
    fontSize: 12,
    color: COLORS.onPrimaryContainer,
    fontWeight: '600',
  },
  toggleEditPointsButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  toggleEditPointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  editPointsDrawer: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupNameField: {
    marginBottom: 6,
  },
  drawerGroupField: {
    marginBottom: 6,
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
  rulesList: {
    gap: 8,
    marginBottom: 10,
  },
  ruleItemCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
  },
  ruleItemHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  ruleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleSubLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  ruleTextInput: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rulePointsInput: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  drawerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  drawerField: {
    flex: 1,
  },
  drawerInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  checkboxLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
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
