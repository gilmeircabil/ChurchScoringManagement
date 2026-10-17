import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from '../utils/haptics';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { ScoreModal } from '../components/ScoreModal';
import { GroupItemsModal } from '../components/GroupItemsModal';
import { EditGroupModal } from '../components/EditGroupModal';
import { AssignGroupModal } from '../components/AssignGroupModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AssignMembersModal } from '../components/AssignMembersModal';
import { IndividualBonusModal } from '../components/IndividualBonusModal';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { PlayerIdBadge } from '../components/PlayerIdBadge';
import { getQuizService } from '../services/quizService';
import { Round, Group, GroupDetail, Player, MainTab, AssignedMember } from '../types';
import { getGroupColor } from '../utils/groupColors';
import { COLORS } from '../constants/colors';
import { APP_CONFIG } from '../constants/config';
import { formatDateDisplay, getTodayISODate, pluralize } from '../utils/formatters';
import { validateGroupCount } from '../utils/validation';
import { getDefaultItemRules } from '../utils/itemPointsStorage';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/errors';

const getDisplayGroupName = (name: string | null | undefined, defaultName: string): string => {
  if (!name || /^group\s*\d+$/i.test(name.trim())) {
    return defaultName;
  }
  return name.trim();
};

interface RoundScreenProps {
  onNavigate: (tab: MainTab) => void;
  onOpenSettings: () => void;
  targetRoundId?: string;
}

export const RoundScreen: React.FC<RoundScreenProps> = ({
  onNavigate: _onNavigate,
  onOpenSettings,
  targetRoundId,
}) => {
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<Round | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupDetails, setGroupDetails] = useState<GroupDetail[]>([]);
  const [unassignedPlayers, setUnassignedPlayers] = useState<Player[]>([]);
  const [counts, setCounts] = useState<{
    totalPlayers: number;
    assignedCount: number;
    unassignedCount: number;
  }>({ totalPlayers: 0, assignedCount: 0, unassignedCount: 0 });

  // Modals
  const [isNewRoundModalVisible, setIsNewRoundModalVisible] = useState(false);
  const [newRoundDate, setNewRoundDate] = useState(getTodayISODate());
  const [newGroupCount, setNewGroupCount] = useState(String(APP_CONFIG.defaultGroupCount));
  const [newRoundError, setNewRoundError] = useState<string | null>(null);

  const [selectedPlayerForAssign, setSelectedPlayerForAssign] = useState<Player | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<{
    groupId: string;
    groupNumber: number;
  } | null>(null);

  // Assign Members Modal (Choose members first, then choose group)
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [targetGroupForAssign, setTargetGroupForAssign] = useState<{ id: string; group_number: number; name?: string | null } | null>(null);

  // Group Scoring Modal
  const [scoringGroup, setScoringGroup] = useState<GroupDetail | null>(null);

  // Edit Group Name Modal
  const [editingGroup, setEditingGroup] = useState<GroupDetail | null>(null);

  // Group Items Carry Bonus Modal
  const [selectedGroupForItems, setSelectedGroupForItems] = useState<GroupDetail | null>(null);

  // Individual Bonus Modal
  const [selectedMemberForBonus, setSelectedMemberForBonus] = useState<{
    member: AssignedMember;
    group: GroupDetail;
  } | null>(null);

  // Group member counts lookup
  const groupMemberCounts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    for (const gd of groupDetails) {
      countsMap[gd.id] = gd.members.length;
    }
    return countsMap;
  }, [groupDetails]);

  // Confirmations
  const [isStartWarningVisible, setIsStartWarningVisible] = useState(false);
  const [isLockConfirmVisible, setIsLockConfirmVisible] = useState(false);
  const [isUnlockConfirmVisible, setIsUnlockConfirmVisible] = useState(false);

  const loadRoundData = useCallback(async (roundId?: string) => {
    try {
      const service = await getQuizService();
      let currentRound: Round | null = null;

      if (roundId) {
        currentRound = await service.rounds.getRoundById(roundId);
      } else {
        currentRound = await service.rounds.getCurrentWorkingRound();
      }

      setRound(currentRound);

      if (currentRound) {
        const roundGroups = await service.groups.getGroupsByRoundId(currentRound.id);
        const details = await service.groups.getGroupDetails(currentRound.id);
        const unassigned = await service.groups.getUnassignedPlayers(currentRound.id);
        const roundCounts = await service.groups.getCountsForRound(currentRound.id);

        setGroups(roundGroups);
        setGroupDetails(details);
        setUnassignedPlayers(unassigned);
        setCounts(roundCounts);
      }
    } catch (err) {
      logError('Failed to load round data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoundData(targetRoundId);
  }, [loadRoundData, targetRoundId]);

  // Open assign dialog for a player
  const handlePlayerTap = async (player: Player) => {
    if (!round) return;
    try {
      const service = await getQuizService();
      const assignment = await service.groups.getPlayerAssignmentInRound(round.id, player.id);

      if (assignment) {
        setCurrentAssignment({
          groupId: assignment.group_id,
          groupNumber: assignment.group_number,
        });
      } else {
        setCurrentAssignment(null);
      }

      setSelectedPlayerForAssign(player);
    } catch (err) {
      logError('Failed to check player assignment:', err);
    }
  };

  // Perform assignment or move
  const handleAssignConfirm = async (groupId: string) => {
    if (!round || !selectedPlayerForAssign) return;
    try {
      const service = await getQuizService();
      await service.groups.assignPlayerToGroup(round.id, groupId, selectedPlayerForAssign.id);
      setSelectedPlayerForAssign(null);
      setCurrentAssignment(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to assign player.', 'RoundScreen'));
    }
  };

  // Remove player from round
  const handleRemoveFromRound = async () => {
    if (!round || !selectedPlayerForAssign) return;
    try {
      const service = await getQuizService();
      await service.groups.removePlayerFromRound(round.id, selectedPlayerForAssign.id);
      setSelectedPlayerForAssign(null);
      setCurrentAssignment(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to remove player from round.', 'RoundScreen'));
    }
  };

  // Create Round
  const handleCreateRound = async () => {
    const groupCountNum = parseInt(newGroupCount, 10);
    const validation = validateGroupCount(groupCountNum);
    if (!validation.isValid) {
      setNewRoundError(validation.error || 'Invalid group count.');
      return;
    }

    try {
      const defaultRules = await getDefaultItemRules();
      const service = await getQuizService();
      const newRound = await service.rounds.createRound(
        newRoundDate.trim(),
        groupCountNum,
        defaultRules
      );
      setIsNewRoundModalVisible(false);
      setNewRoundError(null);
      loadRoundData(newRound.id);
    } catch (_err) {
      setNewRoundError('Failed to create round.');
    }
  };

  // Batch assign selected players to group (choosing members first, then group)
  const handleAssignPlayersToGroup = async (playerIds: string[], groupId: string) => {
    if (!round) return;
    try {
      const service = await getQuizService();
      for (const pId of playerIds) {
        await service.groups.assignPlayerToGroup(round.id, groupId, pId);
      }
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to assign players.', 'RoundScreen'));
    }
  };

  // Save Group Name & Color
  const handleSaveGroupName = async (newName: string | null) => {
    if (!round || !editingGroup) return;
    try {
      const service = await getQuizService();
      await service.groups.updateGroupName(editingGroup.id, newName);
      setEditingGroup(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Unable to update group name.', 'RoundScreen'));
    }
  };

  // Save Group Items Bonus (Book, Pen, Paper, Bible) & Custom Rules/Names
  const handleSaveGroupItems = async (data: {
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
  }) => {
    if (!round || !selectedGroupForItems) return;
    try {
      const service = await getQuizService();
      if (data.applyToAllGroups) {
        await service.groups.updateRoundItemRules(round.id, {
          book_points: data.book_points,
          pen_points: data.pen_points,
          paper_points: data.paper_points,
          bible_points: data.bible_points,
          book_name: data.book_name,
          pen_name: data.pen_name,
          paper_name: data.paper_name,
          bible_name: data.bible_name,
        });
      }
      await service.groups.updateGroupItems(selectedGroupForItems.id, {
        name: data.name,
        book_count: data.book_count,
        pen_count: data.pen_count,
        paper_count: data.paper_count,
        bible_count: data.bible_count,
        book_points: data.book_points,
        pen_points: data.pen_points,
        paper_points: data.paper_points,
        bible_points: data.bible_points,
        book_name: data.book_name,
        pen_name: data.pen_name,
        paper_name: data.paper_name,
        bible_name: data.bible_name,
      });
      setSelectedGroupForItems(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Unable to update group items.', 'RoundScreen'));
    }
  };

  // Start Round transition
  const handleStartRound = async () => {
    if (!round) return;
    if (counts.unassignedCount > 0) {
      setIsStartWarningVisible(true);
      return;
    }
    proceedWithStartRound();
  };

  const proceedWithStartRound = async () => {
    if (!round) return;
    setIsStartWarningVisible(false);
    try {
      const service = await getQuizService();
      await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      loadRoundData(round.id);
    } catch (_err) {
      Alert.alert('Error', 'Unable to start round.');
    }
  };

  // Lock Round
  const handleLockRound = async () => {
    if (!round) return;
    try {
      const service = await getQuizService();
      await service.rounds.updateRoundStatus(round.id, 'LOCKED');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setIsLockConfirmVisible(false);
      loadRoundData(round.id);
    } catch (_err) {
      Alert.alert('Error', 'Unable to lock round.');
    }
  };

  // Unlock Round
  const handleUnlockRound = async () => {
    if (!round) return;
    try {
      const service = await getQuizService();
      await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setIsUnlockConfirmVisible(false);
      loadRoundData(round.id);
    } catch (_err) {
      Alert.alert('Error', 'Unable to unlock round.');
    }
  };

  // Save Group Quiz Score
  const handleSaveGroupScore = async (points: number) => {
    if (!round || !scoringGroup) return;
    if (round.status !== 'ACTIVE') return;
    try {
      const service = await getQuizService();
      await service.scores.saveGroupScore(round.id, scoringGroup.id, points);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setScoringGroup(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Unable to save group score.', 'RoundScreen'));
    }
  };

  // Save Individual Bonus Round Points
  const handleSaveIndividualBonus = async (bonusPoints: number) => {
    if (!round || !selectedMemberForBonus) return;
    try {
      const service = await getQuizService();
      await service.scores.saveIndividualBonus(
        round.id,
        selectedMemberForBonus.member.player_id,
        bonusPoints
      );
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSelectedMemberForBonus(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Unable to save individual bonus.', 'RoundScreen'));
    }
  };



  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // NO ACTIVE ROUND
  if (!round) {
    return (
      <View style={styles.container}>
        <Header title="Round" subtitle="No active round" onSettingsPress={onOpenSettings} />
        <View style={styles.emptyCenter}>
          <EmptyState
            iconName="calendar-outline"
            title="No Active Round"
            description="Create a new weekly round to set up groups and record scores."
            actionText="Create New Round"
            onActionPress={() => {
              setNewRoundDate(getTodayISODate());
              setNewGroupCount(String(APP_CONFIG.defaultGroupCount));
              setNewRoundError(null);
              setIsNewRoundModalVisible(true);
            }}
          />
        </View>

        {/* CREATE ROUND MODAL */}
        {renderCreateRoundModal()}
      </View>
    );
  }

  const isDraft = round.status === 'DRAFT';
  const isActive = round.status === 'ACTIVE';
  const isLocked = round.status === 'LOCKED';

  function renderCreateRoundModal() {
    return (
      <Modal
        visible={isNewRoundModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNewRoundModalVisible(false)}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Round</Text>

            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={newRoundDate}
              onChangeText={setNewRoundDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={styles.groupCountHeaderRow}>
              <Text style={styles.fieldLabel}>Number of Groups</Text>
              <Text style={styles.groupCountHint}>Selected: {newGroupCount}</Text>
            </View>
            <View style={styles.groupCountGrid}>
              {[2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const isSelected = newGroupCount === String(num);
                return (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.countPill,
                      isSelected && styles.countPillSelected,
                    ]}
                    onPress={() => setNewGroupCount(String(num))}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        isSelected && styles.countPillTextSelected,
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {newRoundError && <Text style={styles.errorText}>{newRoundError}</Text>}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setIsNewRoundModalVisible(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmModalButton}
                onPress={handleCreateRound}
              >
                <Text style={styles.confirmModalButtonText}>Create Round</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={formatDateDisplay(round.round_date)}
        subtitle={`${round.group_count} Groups`}
        onSettingsPress={onOpenSettings}
      />

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* TOP STATUS BAR & ACTIONS */}
        <View style={styles.statusBarRow}>
          <RoundStatusBadge status={round.status} />

          <View style={styles.topActionsRight}>
            <TouchableOpacity
              style={styles.newRoundSmallButton}
              onPress={() => {
                setNewRoundDate(getTodayISODate());
                setNewGroupCount(String(APP_CONFIG.defaultGroupCount));
                setNewRoundError(null);
                setIsNewRoundModalVisible(true);
              }}
            >
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.newRoundSmallText}>New Round</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* UNASSIGNED PLAYERS SUMMARY (IN DRAFT OR ACTIVE) */}
        {(isDraft || isActive) && (
          <View style={styles.assignmentSummaryBar}>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryTitle}>
                {counts.assignedCount} of {counts.totalPlayers} Players Assigned
              </Text>
            </View>

            {!isLocked && (
              <TouchableOpacity
                style={styles.assignMembersButtonMinimal}
                onPress={() => {
                  setTargetGroupForAssign(null);
                  setIsAssignModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={counts.unassignedCount > 0 ? 'person-add-outline' : 'people-outline'}
                  size={14}
                  color={COLORS.primary}
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.assignMembersTextMinimal}>
                  {counts.unassignedCount > 0 ? `Assign (${counts.unassignedCount})` : 'Assign'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* GROUPS LIST */}
        <View style={styles.groupsContainer}>
          {groupDetails.map((group) => {
            const groupColor = getGroupColor(group.group_number, group.name);
            const groupDisplayName = getDisplayGroupName(group.name, groupColor.name);
            return (
              <View key={group.id} style={[styles.groupCard, { borderLeftColor: groupColor.hex, borderLeftWidth: 3 }]}>
                <View
                  style={[
                    styles.groupCardHeader,
                    {
                      backgroundColor: groupColor.lightHex,
                      borderBottomColor: groupColor.borderHex,
                    },
                  ]}
                >
                  <View style={styles.groupHeaderLeft}>
                    <View style={[styles.groupColorDot, { backgroundColor: groupColor.hex }]} />
                    <Text
                      style={[styles.groupHeaderTitle, { color: groupColor.textHex }]}
                      numberOfLines={1}
                    >
                      {groupDisplayName}
                    </Text>
                    {!isLocked && (
                      <TouchableOpacity
                        style={styles.editGroupButtonMinimal}
                        onPress={() => setEditingGroup(group)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Edit ${groupDisplayName}`}
                      >
                        <Ionicons name="pencil" size={12} color={groupColor.textHex} style={{ opacity: 0.6 }} />
                      </TouchableOpacity>
                    )}
                    <Text style={[styles.groupHeaderDivider, { color: groupColor.textHex }]}>•</Text>
                    <Text style={[styles.groupMemberCount, { color: groupColor.textHex }]}>
                      {group.members.length} {pluralize(group.members.length, 'player')}
                    </Text>
                    {!isLocked && counts.unassignedCount > 0 && (
                      <TouchableOpacity
                        style={styles.addGroupMemberBtn}
                        onPress={() => {
                          setTargetGroupForAssign(group);
                          setIsAssignModalVisible(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Add player to ${groupDisplayName}`}
                      >
                        <Ionicons name="add" size={13} color={groupColor.textHex} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* GROUP TOTAL SCORE BADGE (Active or Locked) */}
                  {(isActive || isLocked) && (
                    <View
                      style={[
                        styles.groupTotalScoreBadgeMinimal,
                        { borderColor: groupColor.borderHex },
                      ]}
                    >
                      <Text style={[styles.groupTotalScoreTextMinimal, { color: groupColor.textHex }]}>
                        {group.total_score} pts
                      </Text>
                    </View>
                  )}
                </View>

                {group.members.length === 0 ? (
                  <View style={styles.emptyGroupRow}>
                    <Text style={styles.emptyGroupText}>No players</Text>
                    {!isLocked && (
                      <TouchableOpacity
                        onPress={() => {
                          setTargetGroupForAssign(group);
                          setIsAssignModalVisible(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[styles.emptyGroupAssignLink, { color: groupColor.hex }]}>
                          + Assign
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.memberList}>
                    {group.members.map((member, index) => (
                      <View
                        key={member.group_member_id}
                        style={[
                          styles.memberRow,
                          index === group.members.length - 1 && styles.memberRowLast,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.memberInfoButton}
                          disabled={isLocked}
                          onPress={() =>
                            handlePlayerTap({
                              id: member.player_id,
                              name: member.player_name,
                              player_number: member.player_number,
                              active: 1,
                              created_at: '',
                              updated_at: '',
                            })
                          }
                        >
                          <Text style={styles.memberName} numberOfLines={1}>
                            {member.player_name}
                          </Text>
                          <PlayerIdBadge playerNumber={member.player_number} />
                        </TouchableOpacity>

                        <View style={styles.memberRightActions}>
                          {(isActive || isLocked) && (
                            <TouchableOpacity
                              style={[
                                styles.memberBonusButton,
                                (member.bonus_points ?? 0) > 0 && styles.memberBonusButtonActive,
                              ]}
                              onPress={() => setSelectedMemberForBonus({ member, group })}
                              activeOpacity={0.7}
                              accessibilityLabel={`Individual bonus for ${member.player_name}: +${member.bonus_points ?? 0} points`}
                            >
                              <Ionicons
                                name="star"
                                size={11}
                                color={(member.bonus_points ?? 0) > 0 ? '#B45309' : COLORS.textMuted}
                                style={{ marginRight: 3 }}
                              />
                              <Text
                                style={[
                                  styles.memberBonusText,
                                  (member.bonus_points ?? 0) > 0 && styles.memberBonusTextActive,
                                ]}
                              >
                                {(member.bonus_points ?? 0) > 0 ? `+${member.bonus_points}` : 'Bonus'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {!isLocked && (
                            <TouchableOpacity
                              style={styles.memberMoveButton}
                              onPress={() =>
                                handlePlayerTap({
                                  id: member.player_id,
                                  name: member.player_name,
                                  player_number: member.player_number,
                                  active: 1,
                                  created_at: '',
                                  updated_at: '',
                                })
                              }
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityLabel={`Move or remove ${member.player_name}`}
                            >
                              <Ionicons name="swap-horizontal" size={16} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

              {/* GROUP SCORE & ITEMS BONUS FOOTER */}
              {(isActive || isLocked) && (
                <View style={styles.groupScoreFooter}>
                  {isActive ? (
                    <View style={styles.groupScoringRow}>
                      {/* QUIZ SCORE BUTTON FOR GROUP (Click to edit score) */}
                      <TouchableOpacity
                        style={styles.quizScoreButtonMinimal}
                        onPress={() => setScoringGroup(group)}
                        activeOpacity={0.7}
                        accessibilityLabel={`Group quiz score: ${group.quiz_score ?? 0} points. Tap to edit`}
                      >
                        <Text style={styles.quizScoreLabelMinimal}>Quiz:</Text>
                        <Text style={styles.quizScoreValueMinimal}>{group.quiz_score ?? 0}</Text>
                        <Text style={styles.quizScorePtsMinimal}>pts</Text>
                      </TouchableOpacity>

                      {/* ITEMS BONUS BUTTON */}
                      <TouchableOpacity
                        style={[
                          styles.itemsBonusButtonMinimal,
                          group.items_bonus > 0 && styles.itemsBonusButtonMinimalActive,
                        ]}
                        onPress={() => setSelectedGroupForItems(group)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.itemsBonusTextMinimal,
                            group.items_bonus > 0 && styles.itemsBonusTextMinimalActive,
                          ]}
                        >
                          {group.items_bonus > 0 ? `Items: +${group.items_bonus}` : '+ Items'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Locked View */
                    <View style={styles.groupScoreBreakdown}>
                      <Text style={styles.groupBreakdownText}>
                        Quiz: <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>{group.quiz_score ?? 0} pts</Text>
                        {'  '}•{'  '}
                        Items: <Text style={{ fontWeight: '700', color: group.items_bonus > 0 ? COLORS.success : COLORS.textSecondary }}>+{group.items_bonus} pts</Text>
                      </Text>
                    </View>
                  )}

                  {group.items_bonus > 0 && (
                    <Text style={styles.itemsCarrySummaryMinimal}>
                      {[
                        group.book_count > 0 && `${group.book_count} ${group.book_name || 'Book'}${group.book_count > 1 ? 's' : ''}`,
                        group.pen_count > 0 && `${group.pen_count} ${group.pen_name || 'Pen'}${group.pen_count > 1 ? 's' : ''}`,
                        group.paper_count > 0 && `${group.paper_count} ${group.paper_name || 'Paper'}${group.paper_count > 1 ? 's' : ''}`,
                        group.bible_count > 0 && `${group.bible_count} ${group.bible_name || 'Bible'}${group.bible_count > 1 ? 's' : ''}`,
                      ]
                        .filter(Boolean)
                        .join('  •  ')}
                    </Text>
                  )}

                  {isLocked && (
                    <TouchableOpacity
                      style={styles.itemsBonusButtonLocked}
                      onPress={() => setSelectedGroupForItems(group)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="lock-closed" size={13} color={COLORS.textSecondary} />
                      <Text style={styles.itemsBonusButtonLockedText}>
                        Items: +{group.items_bonus} pts
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
        </View>

        {/* BOTTOM ACTION BUTTONS */}
        <View style={styles.bottomActions}>
          {isDraft && (
            <TouchableOpacity
              style={styles.startRoundButtonMinimal}
              onPress={handleStartRound}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.startRoundButtonTextMinimal}>Start Round</Text>
            </TouchableOpacity>
          )}

          {isActive && (
            <TouchableOpacity
              style={styles.lockRoundButtonMinimal}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsLockConfirmVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="lock-closed" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.lockRoundButtonTextMinimal}>Finish & Lock Round</Text>
            </TouchableOpacity>
          )}

          {isLocked && (
            <TouchableOpacity
              style={styles.unlockRoundButtonMinimal}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsUnlockConfirmVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-open-outline" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.unlockRoundButtonTextMinimal}>Unlock Round</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* CREATE ROUND MODAL */}
      {renderCreateRoundModal()}

      {/* ASSIGN / MOVE PLAYER MODAL */}
      {selectedPlayerForAssign && (
        <AssignGroupModal
          visible={Boolean(selectedPlayerForAssign)}
          playerName={selectedPlayerForAssign.name}
          playerNumber={selectedPlayerForAssign.player_number}
          groups={groups}
          currentAssignedGroupId={currentAssignment?.groupId}
          currentAssignedGroupNumber={currentAssignment?.groupNumber}
          onAssign={handleAssignConfirm}
          onRemoveFromRound={currentAssignment ? handleRemoveFromRound : undefined}
          onClose={() => {
            setSelectedPlayerForAssign(null);
            setCurrentAssignment(null);
          }}
        />
      )}

      {/* ASSIGN MEMBERS MODAL (CHOOSE MEMBERS FIRST, THEN GROUP) */}
      <AssignMembersModal
        visible={isAssignModalVisible}
        targetGroup={targetGroupForAssign}
        unassignedPlayers={unassignedPlayers}
        groups={groups}
        groupMemberCounts={groupMemberCounts}
        onAssignPlayersToGroup={handleAssignPlayersToGroup}
        onClose={() => {
          setIsAssignModalVisible(false);
          setTargetGroupForAssign(null);
        }}
      />

      {/* GROUP SCORE ENTRY MODAL */}
      {scoringGroup && (
        <ScoreModal
          visible={Boolean(scoringGroup)}
          title="Enter Group Score"
          groupNumber={scoringGroup.group_number}
          groupName={getDisplayGroupName(scoringGroup.name, getGroupColor(scoringGroup.group_number, scoringGroup.name).name)}
          currentScore={scoringGroup.quiz_score ?? 0}
          onSave={handleSaveGroupScore}
          onClose={() => setScoringGroup(null)}
        />
      )}

      {/* EDIT GROUP NAME & COLOR MODAL */}
      {editingGroup && (
        <EditGroupModal
          visible={Boolean(editingGroup)}
          groupNumber={editingGroup.group_number}
          currentName={getDisplayGroupName(editingGroup.name, getGroupColor(editingGroup.group_number, editingGroup.name).name)}
          onSave={handleSaveGroupName}
          onClose={() => setEditingGroup(null)}
        />
      )}

      {/* GROUP ITEMS BONUS MODAL (BOOK, PEN, PAPER, BIBLE) */}
      {selectedGroupForItems && (
        <GroupItemsModal
          visible={Boolean(selectedGroupForItems)}
          groupNumber={selectedGroupForItems.group_number}
          groupId={selectedGroupForItems.id}
          groupName={getDisplayGroupName(selectedGroupForItems.name, getGroupColor(selectedGroupForItems.group_number, selectedGroupForItems.name).name)}
          quizScore={selectedGroupForItems.quiz_score}
          initialBookCount={selectedGroupForItems.book_count}
          initialPenCount={selectedGroupForItems.pen_count}
          initialPaperCount={selectedGroupForItems.paper_count}
          initialBibleCount={selectedGroupForItems.bible_count}
          initialBookPoints={selectedGroupForItems.book_points}
          initialPenPoints={selectedGroupForItems.pen_points}
          initialPaperPoints={selectedGroupForItems.paper_points}
          initialBiblePoints={selectedGroupForItems.bible_points}
          initialBookName={selectedGroupForItems.book_name}
          initialPenName={selectedGroupForItems.pen_name}
          initialPaperName={selectedGroupForItems.paper_name}
          initialBibleName={selectedGroupForItems.bible_name}
          isLocked={isLocked}
          onSave={handleSaveGroupItems}
          onClose={() => setSelectedGroupForItems(null)}
        />
      )}

      {/* UNASSIGNED WARNING MODAL */}
      <ConfirmationModal
        visible={isStartWarningVisible}
        title="Unassigned Players"
        message={`${counts.unassignedCount} players are not assigned to a group.`}
        subMessage="Do you want to continue and start the round anyway?"
        confirmText="Continue"
        cancelText="Go Back"
        onConfirm={proceedWithStartRound}
        onCancel={() => setIsStartWarningVisible(false)}
      />

      {/* LOCK CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={isLockConfirmVisible}
        title="Finish Round?"
        message="After locking, scores and group assignments cannot normally be edited."
        confirmText="Lock Round"
        cancelText="Cancel"
        iconName="lock-closed"
        iconColor={COLORS.primary}
        onConfirm={handleLockRound}
        onCancel={() => setIsLockConfirmVisible(false)}
      />

      {/* UNLOCK CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={isUnlockConfirmVisible}
        title="Unlock Round?"
        message="Unlock this round to make changes to groups or scores?"
        confirmText="Unlock"
        cancelText="Cancel"
        iconName="lock-open-outline"
        onConfirm={handleUnlockRound}
        onCancel={() => setIsUnlockConfirmVisible(false)}
      />

      {/* INDIVIDUAL BONUS ROUND MODAL */}
      {selectedMemberForBonus && (
        <IndividualBonusModal
          visible={Boolean(selectedMemberForBonus)}
          playerName={selectedMemberForBonus.member.player_name}
          playerNumber={selectedMemberForBonus.member.player_number}
          groupName={selectedMemberForBonus.group.name}
          groupNumber={selectedMemberForBonus.group.group_number}
          groupCarryScore={selectedMemberForBonus.group.total_score}
          initialBonus={selectedMemberForBonus.member.bonus_points ?? 0}
          onSave={handleSaveIndividualBonus}
          onClose={() => setSelectedMemberForBonus(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  statusBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topActionsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  newRoundSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  newRoundSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  assignmentSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  summaryInfo: {
    flex: 1,
    marginRight: 10,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  summarySub: {
    fontSize: 12,
    color: COLORS.warning,
    marginTop: 2,
    fontWeight: '600',
  },
  assignMembersButtonMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  assignMembersTextMinimal: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  groupsContainer: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  groupColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    marginRight: 6,
  },
  groupHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  groupHeaderDivider: {
    fontSize: 12,
    opacity: 0.4,
    marginHorizontal: 1,
  },
  groupMemberCount: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
    flexShrink: 0,
  },
  editGroupButtonMinimal: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addGroupMemberBtn: {
    padding: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginLeft: 3,
  },
  groupTotalScoreBadgeMinimal: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  groupTotalScoreTextMinimal: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyGroupText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  emptyGroupAssignLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberList: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  memberRowLast: {
    borderBottomWidth: 0,
  },
  memberInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  memberMoveButton: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberBonusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  memberBonusButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  memberBonusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  memberBonusTextActive: {
    color: '#B45309',
  },
  groupScoreFooter: {
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  groupScoringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  quizScoreButtonMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
    gap: 4,
  },
  quizScoreLabelMinimal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  quizScoreValueMinimal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  quizScorePtsMinimal: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  itemsBonusButtonMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  itemsBonusButtonMinimalActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  itemsBonusTextMinimal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  itemsBonusTextMinimalActive: {
    color: COLORS.success,
    fontWeight: '700',
  },
  groupScoreBreakdown: {
    gap: 2,
  },
  groupBreakdownText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemsCarrySummaryMinimal: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemsBonusButtonLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  itemsBonusButtonLockedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  bottomActions: {
    marginTop: 20,
  },
  startRoundButtonMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 10,
  },
  startRoundButtonTextMinimal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lockRoundButtonMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  lockRoundButtonTextMinimal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unlockRoundButtonMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingVertical: 12,
    borderRadius: 10,
  },
  unlockRoundButtonTextMinimal: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  groupCountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupCountHint: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  groupCountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  countPill: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryContainer,
  },
  countPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  countPillTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmModalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmModalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

