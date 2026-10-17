import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Group } from '../types';
import { COLORS } from '../constants/colors';
import { PlayerIdBadge } from './PlayerIdBadge';
import { getGroupColor } from '../utils/groupColors';

interface AssignGroupModalProps {
  visible: boolean;
  playerName: string;
  playerNumber: number;
  groups: Group[];
  currentAssignedGroupId?: string;
  currentAssignedGroupNumber?: number;
  onAssign: (groupId: string) => void;
  onRemoveFromRound?: () => void;
  onClose: () => void;
}

export const AssignGroupModal: React.FC<AssignGroupModalProps> = ({
  visible,
  playerName,
  playerNumber,
  groups,
  currentAssignedGroupId,
  currentAssignedGroupNumber,
  onAssign,
  onRemoveFromRound,
  onClose,
}) => {
  // If player is already assigned, viewMode starts as 'assigned_actions'
  // If player is not assigned, viewMode starts as 'select_group'
  const isCurrentlyAssigned = Boolean(currentAssignedGroupId);
  const [viewMode, setViewMode] = useState<'assigned_actions' | 'select_group'>('select_group');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      if (isCurrentlyAssigned) {
        setViewMode('assigned_actions');
        setSelectedGroupId(currentAssignedGroupId || '');
      } else {
        setViewMode('select_group');
        setSelectedGroupId('');
      }
    }
  }, [visible, isCurrentlyAssigned, currentAssignedGroupId, groups]);

  const handleConfirmAssign = () => {
    if (!selectedGroupId) return;
    onAssign(selectedGroupId);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>
            {isCurrentlyAssigned
              ? viewMode === 'select_group'
                ? 'Move Player'
                : 'Player Assigned'
              : 'Assign Player'}
          </Text>

          {/* Player info card */}
          <View style={styles.playerInfoRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {playerName}
            </Text>
            <PlayerIdBadge playerNumber={playerNumber} />
          </View>

          {/* Mode 1: Already Assigned Actions */}
          {isCurrentlyAssigned && viewMode === 'assigned_actions' && (() => {
            const currentGroup = groups.find((g) => g.id === currentAssignedGroupId || g.group_number === currentAssignedGroupNumber);
            const currentGroupColor = currentGroup ? getGroupColor(currentGroup.group_number, currentGroup.name) : currentAssignedGroupNumber ? getGroupColor(currentAssignedGroupNumber, null) : null;
            const currentGroupName = currentGroup?.name && !/^group\s*\d+$/i.test(currentGroup.name.trim()) ? currentGroup.name.trim() : currentGroupColor?.name || 'Assigned';

            return (
              <View style={styles.contentSection}>
                <View style={styles.currentGroupBanner}>
                  {currentGroupColor ? (
                    <View style={[styles.groupColorDot, { backgroundColor: currentGroupColor.hex, marginRight: 8 }]} />
                  ) : (
                    <Ionicons name="people" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.currentGroupLabel}>
                    Assigned to:{' '}
                    <Text style={styles.currentGroupValue}>
                      {currentGroupName}
                    </Text>
                  </Text>
                </View>

              <View style={styles.buttonStack}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setViewMode('select_group')}
                >
                  <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionButtonText}>Change Group</Text>
                </TouchableOpacity>

                {onRemoveFromRound && (
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={onRemoveFromRound}
                  >
                    <Ionicons name="person-remove-outline" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
                    <Text style={styles.dangerButtonText}>Remove From Round</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.cancelTextButton} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

          {/* Mode 2: Select Group (for new assignment or moving) */}
          {viewMode === 'select_group' && (
            <View style={styles.contentSection}>
              <Text style={styles.sectionHeader}>Choose Group:</Text>

              <ScrollView style={styles.groupsList} contentContainerStyle={styles.groupsListContent}>
                {groups.map((group) => {
                  const isSelected = selectedGroupId === group.id;
                  const isCurrent = currentAssignedGroupId === group.id;
                  const groupColor = getGroupColor(group.group_number, group.name);
                  const displayGroupName = group.name && !/^group\s*\d+$/i.test(group.name.trim())
                    ? group.name.trim()
                    : groupColor.name;

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupOption,
                        isSelected && styles.groupOptionSelected,
                      ]}
                      onPress={() => setSelectedGroupId(group.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.radioOuter}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View style={[styles.groupColorDot, { backgroundColor: groupColor.hex }]} />
                      <Text
                        style={[
                          styles.groupOptionText,
                          isSelected && styles.groupOptionTextSelected,
                        ]}
                      >
                        {displayGroupName}
                        {isCurrent ? ' (Current)' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    if (isCurrentlyAssigned) {
                      setViewMode('assigned_actions');
                    } else {
                      onClose();
                    }
                  }}
                >
                  <Text style={styles.cancelButtonText}>
                    {isCurrentlyAssigned ? 'Back' : 'Cancel'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.assignButton,
                    !selectedGroupId && styles.assignButtonDisabled,
                  ]}
                  onPress={handleConfirmAssign}
                  disabled={!selectedGroupId}
                >
                  <Text style={styles.assignButtonText}>
                    {isCurrentlyAssigned ? 'Move' : 'Assign'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
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
    borderRadius: 16,
    padding: 22,
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
    marginBottom: 10,
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  contentSection: {
    width: '100%',
  },
  currentGroupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  currentGroupLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  currentGroupValue: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  buttonStack: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.dangerContainer,
    borderWidth: 1,
    borderColor: COLORS.danger,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelTextButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  groupsList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  groupsListContent: {
    gap: 8,
  },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  groupOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryContainer,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  groupColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  groupOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  groupOptionTextSelected: {
    color: COLORS.primary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  assignButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  assignButtonDisabled: {
    opacity: 0.5,
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
