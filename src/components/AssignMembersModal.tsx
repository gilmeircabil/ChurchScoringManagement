import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Player, Group } from '../types';
import { COLORS } from '../constants/colors';
import { PlayerIdBadge } from './PlayerIdBadge';
import { SearchBar } from './SearchBar';
import { getGroupColor } from '../utils/groupColors';
import { pluralize } from '../utils/formatters';
import * as Haptics from '../utils/haptics';

interface AssignMembersModalProps {
  visible: boolean;
  unassignedPlayers: Player[];
  groups: Group[];
  targetGroup?: { id: string; group_number: number; name?: string | null } | null;
  groupMemberCounts?: Record<string, number>;
  onAssignPlayersToGroup: (playerIds: string[], groupId: string) => Promise<void>;
  onClose: () => void;
}

export const AssignMembersModal: React.FC<AssignMembersModalProps> = ({
  visible,
  unassignedPlayers,
  groups,
  targetGroup,
  groupMemberCounts = {},
  onAssignPlayersToGroup,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const flatListRef = useRef<FlatList<Player>>(null);

  const targetColor = targetGroup ? getGroupColor(targetGroup.group_number, targetGroup.name) : null;
  const targetDisplayName = targetGroup
    ? targetGroup.name && !/^group\s*\d+$/i.test(targetGroup.name.trim())
      ? targetGroup.name.trim()
      : targetColor?.name || `Group ${targetGroup.group_number}`
    : null;

  useEffect(() => {
    if (visible) {
      setSelectedIds([]);
      setSearchQuery('');
      setIsAssigning(false);
    }
  }, [visible]);

  // Selected players go to the top, with newest selected first
  const displayPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? unassignedPlayers.filter((p) => p.name.toLowerCase().includes(q))
      : [...unassignedPlayers];

    return filtered.sort((a, b) => {
      const aIdx = selectedIds.indexOf(a.id);
      const bIdx = selectedIds.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });
  }, [unassignedPlayers, searchQuery, selectedIds]);

  const toggleSelectPlayer = (id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const isAdding = !selectedIds.includes(id);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [id, ...prev];
    });

    if (isAdding) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
  };

  const handleAssignToGroup = async (group: { id: string }) => {
    if (selectedIds.length === 0) return;
    setIsAssigning(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await onAssignPlayersToGroup(selectedIds, group.id);
      setSelectedIds([]);
      if (targetGroup) {
        onClose();
      }
    } finally {
      setIsAssigning(false);
    }
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
            {targetGroup && targetColor ? (
              <View style={styles.targetHeaderTitleRow}>
                <View style={[styles.targetHeaderDot, { backgroundColor: targetColor.hex }]} />
                <Text style={styles.title} numberOfLines={1}>
                  Add to {targetDisplayName}
                </Text>
              </View>
            ) : (
              <Text style={styles.title}>Assign Members</Text>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {unassignedPlayers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={54} color={COLORS.success} />
              <Text style={styles.emptyTitle}>All Players Assigned!</Text>
              <Text style={styles.emptySubtitle}>
                Every player has been assigned to a group for this round.
              </Text>
              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Search */}
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search players..."
                style={{ marginBottom: selectedIds.length > 0 ? 8 : 12 }}
              />

              {/* Selection Count Pill */}
              {selectedIds.length > 0 && (
                <View style={styles.countBadgeRow}>
                  <Text style={styles.countBadgeText}>
                    {selectedIds.length} selected
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedIds([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.clearSelectionLink}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Members List with Checkboxes */}
              <FlatList
                ref={flatListRef}
                data={displayPlayers}
                keyExtractor={(item) => item.id}
                style={styles.playerList}
                contentContainerStyle={styles.playerListContent}
                ListEmptyComponent={
                  <View style={styles.noSearchContainer}>
                    <Ionicons name="search-outline" size={22} color={COLORS.textMuted} />
                    <Text style={styles.noSearchText}>
                      No unassigned players matching &ldquo;{searchQuery}&rdquo;
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.playerRow, isSelected && styles.playerRowSelected]}
                      onPress={() => toggleSelectPlayer(item.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <PlayerIdBadge playerNumber={item.player_number} size="sm" />
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Footer: Target Group button OR Groups Grid */}
              {targetGroup && targetColor ? (
                <View style={styles.singleGroupFooter}>
                  <TouchableOpacity
                    style={[
                      styles.singleAssignButton,
                      { backgroundColor: targetColor.hex },
                      (selectedIds.length === 0 || isAssigning) && styles.singleAssignButtonDisabled,
                    ]}
                    onPress={() => handleAssignToGroup(targetGroup)}
                    disabled={selectedIds.length === 0 || isAssigning}
                    activeOpacity={0.85}
                  >
                    {isAssigning ? (
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : (
                      <Ionicons name="person-add" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.singleAssignButtonText}>
                      {isAssigning
                        ? 'Adding members...'
                        : selectedIds.length > 0
                        ? `Add ${selectedIds.length} ${pluralize(selectedIds.length, 'Player')} to ${targetDisplayName}`
                        : `Select players to add to ${targetDisplayName}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.groupPickerFooter}>
                  <View style={styles.groupPickerHeader}>
                    <Text style={styles.groupPickerTitle}>
                      {selectedIds.length > 0
                        ? `Assign ${selectedIds.length} to:`
                        : 'Assign to:'}
                    </Text>
                  </View>

                  {isAssigning ? (
                    <View style={styles.assigningLoader}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.assigningText}>Assigning members...</Text>
                    </View>
                  ) : (
                    <View style={styles.groupsGrid}>
                      {groups.map((g) => {
                        const color = getGroupColor(g.group_number, g.name);
                        const memberCount = groupMemberCounts[g.id] ?? 0;
                        const isDisabled = selectedIds.length === 0;

                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={[
                              styles.groupButton,
                              {
                                backgroundColor: color.lightHex,
                                borderColor: color.borderHex,
                              },
                              isDisabled && styles.groupButtonDisabled,
                            ]}
                            onPress={() => handleAssignToGroup(g)}
                            disabled={isDisabled}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.groupDot, { backgroundColor: color.hex }]} />
                            <View style={styles.groupTextColumn}>
                              <Text
                                style={[
                                  styles.groupNameText,
                                  { color: color.textHex },
                                  isDisabled && styles.groupTextDisabled,
                                ]}
                                numberOfLines={1}
                              >
                                {g.name && !/^group\s*\d+$/i.test(g.name.trim()) ? g.name.trim() : color.name}
                              </Text>
                              <Text style={styles.groupCountSubText}>
                                {memberCount} {pluralize(memberCount, 'member')}
                              </Text>
                            </View>
                            {!isDisabled && (
                              <Ionicons
                                name="arrow-forward"
                                size={14}
                                color={color.textHex}
                                style={{ marginLeft: 4 }}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </>
          )}
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
    padding: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  headerBar: {
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
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  clearSelectionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  playerList: {
    maxHeight: 260,
    flexShrink: 1,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playerListContent: {
    padding: 6,
    gap: 4,
  },
  noSearchContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noSearchText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    minHeight: 44,
  },
  playerRowSelected: {
    backgroundColor: COLORS.primaryContainer,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: COLORS.surface,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  groupPickerFooter: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  groupPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupPickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupPickerHint: {
    fontSize: 11,
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  groupsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  groupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    width: '48.5%',
    minHeight: 48,
  },
  groupButtonDisabled: {
    opacity: 0.45,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  groupTextColumn: {
    flex: 1,
  },
  groupNameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  groupTextDisabled: {
    color: COLORS.textMuted,
  },
  groupCountSubText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  assigningLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  assigningText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  targetHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  targetHeaderDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  singleGroupFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 4,
  },
  singleAssignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  singleAssignButtonDisabled: {
    opacity: 0.45,
  },
  singleAssignButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
