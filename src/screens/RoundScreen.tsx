import React, { useState, useEffect, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { ScoreModal } from '../components/ScoreModal';
import { GroupItemsModal } from '../components/GroupItemsModal';
import { AssignGroupModal } from '../components/AssignGroupModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { UnassignedListModal } from '../components/UnassignedListModal';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { PlayerIdBadge } from '../components/PlayerIdBadge';
import { SearchBar } from '../components/SearchBar';
import { getQuizService } from '../services/quizService';
import { Round, Group, GroupDetail, Player, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { APP_CONFIG } from '../constants/config';
import { formatDateDisplay, getTodayISODate, pluralize } from '../utils/formatters';
import { validateGroupCount } from '../utils/validation';
import { getDefaultItemPoints } from '../utils/itemPointsStorage';

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

  // Player search in Grouping mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);

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

  const [isUnassignedModalVisible, setIsUnassignedModalVisible] = useState(false);

  // Group Scoring Modal
  const [scoringGroup, setScoringGroup] = useState<GroupDetail | null>(null);

  // Group Items Carry Bonus Modal
  const [selectedGroupForItems, setSelectedGroupForItems] = useState<GroupDetail | null>(null);

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
      console.error('Failed to load round data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoundData(targetRoundId);
  }, [loadRoundData, targetRoundId]);

  // Handle Search for players
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const service = await getQuizService();
      const results = await service.players.searchPlayers(query, true);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

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
      console.error('Failed to check player assignment:', err);
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
      setSearchQuery('');
      setSearchResults([]);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to assign player.');
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
      Alert.alert('Error', err.message || 'Failed to remove player from round.');
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
      const defaultPoints = await getDefaultItemPoints();
      const service = await getQuizService();
      const newRound = await service.rounds.createRound(
        newRoundDate.trim(),
        groupCountNum,
        defaultPoints
      );
      setIsNewRoundModalVisible(false);
      setNewRoundError(null);
      loadRoundData(newRound.id);
    } catch (_err) {
      setNewRoundError('Failed to create round.');
    }
  };

  // Save Group Items Bonus (Book, Pen, Paper) & Custom Rules/Names
  const handleSaveGroupItems = async (data: {
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
  }) => {
    if (!round || !selectedGroupForItems) return;
    try {
      const service = await getQuizService();
      if (data.applyToAllGroups) {
        await service.groups.updateRoundItemRules(round.id, {
          book_points: data.book_points,
          pen_points: data.pen_points,
          paper_points: data.paper_points,
          book_name: data.book_name,
          pen_name: data.pen_name,
          paper_name: data.paper_name,
        });
      }
      await service.groups.updateGroupItems(selectedGroupForItems.id, {
        name: data.name,
        book_count: data.book_count,
        pen_count: data.pen_count,
        paper_count: data.paper_count,
        book_points: data.book_points,
        pen_points: data.pen_points,
        paper_points: data.paper_points,
        book_name: data.book_name,
        pen_name: data.pen_name,
        paper_name: data.paper_name,
      });
      setSelectedGroupForItems(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update group items.');
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
      Alert.alert('Error', err.message || 'Unable to save group score.');
    }
  };

  // Quick Stepper for group quiz score (+5, -5)
  const handleQuickStepGroupScore = async (group: GroupDetail, delta: number) => {
    if (!round || round.status !== 'ACTIVE') return;
    const currentScore = group.quiz_score || 0;
    const newScore = Math.max(0, currentScore + delta);
    if (newScore === currentScore && delta < 0) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Optimistically update groupDetails state for instant UI feedback
    setGroupDetails((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? {
              ...g,
              quiz_score: newScore,
              total_score: newScore + g.items_bonus,
              members: g.members.map((m) => ({ ...m, round_score: newScore + g.items_bonus })),
            }
          : g
      )
    );

    try {
      const service = await getQuizService();
      await service.scores.saveGroupScore(round.id, group.id, newScore);
      loadRoundData(round.id);
    } catch (err: any) {
      loadRoundData(round.id);
      Alert.alert('Error', err.message || 'Unable to update group score.');
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

            <Text style={styles.fieldLabel}>Number of Groups</Text>
            <View style={styles.groupCountRow}>
              {Array.from(
                { length: 5 },
                (_, i) => APP_CONFIG.minGroupCount + i
              ).map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.countPill,
                    newGroupCount === String(num) && styles.countPillSelected,
                  ]}
                  onPress={() => setNewGroupCount(String(num))}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      newGroupCount === String(num) && styles.countPillTextSelected,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={newGroupCount}
              onChangeText={setNewGroupCount}
              keyboardType="number-pad"
              placeholder="Custom group count"
              placeholderTextColor={COLORS.textMuted}
            />

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
        subtitle={`Status: ${round.status} • ${round.group_count} Groups`}
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
            <View>
              <Text style={styles.summaryTitle}>
                {counts.totalPlayers} Total Players
              </Text>
              <Text style={styles.summarySub}>
                Assigned: <Text style={{ fontWeight: '700', color: COLORS.success }}>{counts.assignedCount}</Text>
                {'  '}•{'  '}
                Unassigned: <Text style={{ fontWeight: '700', color: counts.unassignedCount > 0 ? COLORS.warning : COLORS.textSecondary }}>{counts.unassignedCount}</Text>
              </Text>
            </View>

            {counts.unassignedCount > 0 && (
              <TouchableOpacity
                style={styles.viewUnassignedButton}
                onPress={() => setIsUnassignedModalVisible(true)}
              >
                <Text style={styles.viewUnassignedText}>View Unassigned</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SEARCH BAR FOR QUICK GROUPING (WHEN NOT LOCKED) */}
        {!isLocked && (
          <View style={styles.searchSection}>
            <SearchBar
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search player to assign or move..."
              matchCount={searchResults.length}
              showMatchCount={searchQuery.trim().length > 0}
            />

            {/* SEARCH RESULTS DROPDOWN */}
            {searchQuery.trim().length > 0 && (
              <View style={styles.searchResultsBox}>
                {searchResults.length > 0 ? (
                  <>
                    <View style={styles.searchResultsHeader}>
                      <Text style={styles.searchResultsTitle}>Select player to assign</Text>
                      <Text style={styles.searchResultsCountBadge}>
                        {searchResults.length} {pluralize(searchResults.length, 'player')}
                      </Text>
                    </View>
                    <ScrollView
                      style={styles.searchResultsScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {searchResults.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.searchResultItem}
                          onPress={() => handlePlayerTap(p)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.searchResultLeft}>
                            <View style={styles.searchResultAvatar}>
                              <Text style={styles.searchResultAvatarText}>
                                {p.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.searchResultName}>{p.name}</Text>
                          </View>
                          <PlayerIdBadge playerNumber={p.player_number} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                ) : (
                  <View style={styles.searchEmptyBox}>
                    <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
                    <Text style={styles.searchEmptyText}>
                      No players matching "{searchQuery.trim()}"
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* GROUPS LIST */}
        <View style={styles.groupsContainer}>
          {groupDetails.map((group) => (
            <View key={group.id} style={styles.groupCard}>
              <View style={styles.groupCardHeader}>
                <View style={styles.groupNumberCircle}>
                  <Text style={styles.groupNumberText}>{group.group_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupHeaderTitle} numberOfLines={1}>
                    GROUP {group.group_number}{group.name ? ` — ${group.name}` : ''}
                  </Text>
                  <Text style={styles.groupMemberCount}>
                    {group.members.length} {pluralize(group.members.length, 'player')}
                  </Text>
                </View>

                {/* GROUP TOTAL SCORE BADGE (Active or Locked) */}
                {(isActive || isLocked) && (
                  <View style={styles.groupTotalScoreBadge}>
                    <Text style={styles.groupTotalScoreLabel}>TOTAL</Text>
                    <Text style={styles.groupTotalScoreValue}>{group.total_score}</Text>
                    <Text style={styles.groupTotalScorePts}>pts</Text>
                  </View>
                )}
              </View>

              {group.members.length === 0 ? (
                <View style={styles.emptyGroupMessage}>
                  <Text style={styles.emptyGroupText}>No players assigned</Text>
                </View>
              ) : (
                <View style={styles.memberList}>
                  {group.members.map((member) => (
                    <View key={member.group_member_id} style={styles.memberRow}>
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
                  ))}
                </View>
              )}

              {/* GROUP SCORE & ITEMS BONUS FOOTER */}
              {(isActive || isLocked) && (
                <View style={styles.groupScoreFooter}>
                  {isActive ? (
                    <View style={styles.groupScoringRow}>
                      {/* QUIZ SCORE STEPPER FOR GROUP */}
                      <View style={styles.groupQuizScoreSection}>
                        <Text style={styles.groupScoringSectionLabel}>Quiz Score</Text>
                        <View style={styles.groupScoreActionRow}>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleQuickStepGroupScore(group, -5)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            accessibilityLabel="Subtract 5 points from group"
                          >
                            <Ionicons name="remove" size={14} color={COLORS.textSecondary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.scorePill}
                            onPress={() => setScoringGroup(group)}
                            activeOpacity={0.7}
                            accessibilityLabel={`Group quiz score: ${group.quiz_score ?? 0} points. Tap to edit`}
                          >
                            <Text style={styles.scorePillValue}>{group.quiz_score ?? 0}</Text>
                            <Text style={styles.scorePillLabel}>pts</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleQuickStepGroupScore(group, 5)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            accessibilityLabel="Add 5 points to group"
                          >
                            <Ionicons name="add" size={14} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* ITEMS BONUS BUTTON */}
                      <TouchableOpacity
                        style={[
                          styles.itemsBonusButton,
                          group.items_bonus > 0 && styles.itemsBonusButtonActive,
                        ]}
                        onPress={() => setSelectedGroupForItems(group)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={group.items_bonus > 0 ? 'checkmark-circle' : 'add-circle-outline'}
                          size={15}
                          color={group.items_bonus > 0 ? COLORS.success : COLORS.primary}
                        />
                        <Text
                          style={[
                            styles.itemsBonusButtonText,
                            group.items_bonus > 0 && styles.itemsBonusButtonTextActive,
                          ]}
                        >
                          {group.items_bonus > 0 ? `Items (+${group.items_bonus} pts)` : '+ Add Items Carry'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Locked View */
                    <View style={styles.groupScoreBreakdown}>
                      <Text style={styles.groupBreakdownText}>
                        Quiz: <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>{group.quiz_score ?? 0} pts</Text>
                        {'  '}•{'  '}
                        Items Bonus: <Text style={{ fontWeight: '700', color: group.items_bonus > 0 ? COLORS.success : COLORS.textSecondary }}>+{group.items_bonus} pts</Text>
                      </Text>
                    </View>
                  )}

                  {group.items_bonus > 0 && (
                    <Text style={styles.groupItemsCarryDetail}>
                      📖 {group.book_count} {group.book_name || 'Book'}{group.book_count !== 1 ? 's' : ''} ({group.book_count * group.book_points} pts) • 🖊️ {group.pen_count} {group.pen_name || 'Pen'}{group.pen_count !== 1 ? 's' : ''} ({group.pen_count * group.pen_points} pts) • 📄 {group.paper_count} {group.paper_name || 'Paper'}{group.paper_count !== 1 ? 's' : ''} ({group.paper_count * group.paper_points} pts)
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
          ))}
        </View>

        {/* BOTTOM ACTION BUTTONS */}
        <View style={styles.bottomActions}>
          {isDraft && (
            <TouchableOpacity
              style={styles.gradientButtonWrapper}
              onPress={handleStartRound}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#059669', '#10B981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startRoundButton}
              >
                <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.startRoundButtonText}>Start Round</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isActive && (
            <TouchableOpacity
              style={styles.gradientButtonWrapper}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsLockConfirmVisible(true);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.lockRoundButton}
              >
                <Ionicons name="lock-closed" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.lockRoundButtonText}>Finish & Lock Round</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isLocked && (
            <TouchableOpacity
              style={styles.unlockRoundButton}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsUnlockConfirmVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-open-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.unlockRoundButtonText}>Unlock Round</Text>
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

      {/* UNASSIGNED PLAYERS LIST MODAL */}
      <UnassignedListModal
        visible={isUnassignedModalVisible}
        unassignedPlayers={unassignedPlayers}
        onSelectPlayer={(player) => {
          setIsUnassignedModalVisible(false);
          handlePlayerTap(player);
        }}
        onClose={() => setIsUnassignedModalVisible(false)}
      />

      {/* GROUP SCORE ENTRY MODAL */}
      {scoringGroup && (
        <ScoreModal
          visible={Boolean(scoringGroup)}
          title="Enter Group Score"
          groupNumber={scoringGroup.group_number}
          groupName={scoringGroup.name}
          currentScore={scoringGroup.quiz_score ?? 0}
          onSave={handleSaveGroupScore}
          onClose={() => setScoringGroup(null)}
        />
      )}

      {/* GROUP ITEMS BONUS MODAL (BOOK, PEN, PAPER) */}
      {selectedGroupForItems && (
        <GroupItemsModal
          visible={Boolean(selectedGroupForItems)}
          groupNumber={selectedGroupForItems.group_number}
          groupId={selectedGroupForItems.id}
          groupName={selectedGroupForItems.name}
          quizScore={selectedGroupForItems.quiz_score}
          initialBookCount={selectedGroupForItems.book_count}
          initialPenCount={selectedGroupForItems.pen_count}
          initialPaperCount={selectedGroupForItems.paper_count}
          initialBookPoints={selectedGroupForItems.book_points}
          initialPenPoints={selectedGroupForItems.pen_points}
          initialPaperPoints={selectedGroupForItems.paper_points}
          initialBookName={selectedGroupForItems.book_name}
          initialPenName={selectedGroupForItems.pen_name}
          initialPaperName={selectedGroupForItems.paper_name}
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
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  summarySub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  viewUnassignedButton: {
    backgroundColor: COLORS.accentContainer,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  viewUnassignedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onAccentContainer,
  },
  searchSection: {
    marginBottom: 14,
    position: 'relative',
    zIndex: 10,
  },
  searchResultsBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    marginTop: 6,
    padding: 8,
    maxHeight: 240,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  searchResultsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchResultsCountBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  searchResultsScroll: {
    maxHeight: 180,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  searchResultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  searchResultAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  searchEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  searchEmptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  groupsContainer: {
    gap: 14,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  groupNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  groupHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    flex: 1,
  },
  groupMemberCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  emptyGroupMessage: {
    padding: 16,
    alignItems: 'center',
  },
  emptyGroupText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  memberList: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  memberInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  memberMoveButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupScoringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupQuizScoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupScoringSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupScoreActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 48,
    justifyContent: 'center',
  },
  scorePillValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  scorePillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryLight,
    marginLeft: 2,
  },
  lockedScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  lockedScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
  groupTotalScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  groupTotalScoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 4,
    textTransform: 'uppercase',
  },
  groupTotalScoreValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  groupTotalScorePts: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryLight,
    marginLeft: 2,
  },
  groupScoreFooter: {
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'column',
    gap: 8,
  },
  groupScoreBreakdown: {
    gap: 2,
  },
  groupBreakdownText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  groupItemsCarryDetail: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  itemsBonusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 6,
  },
  itemsBonusButtonActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  itemsBonusButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  itemsBonusButtonTextActive: {
    color: COLORS.success,
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
    marginTop: 24,
  },
  gradientButtonWrapper: {
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  startRoundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  startRoundButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lockRoundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  lockRoundButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unlockRoundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unlockRoundButtonText: {
    fontSize: 15,
    fontWeight: '700',
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
  groupCountRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  countPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  countPillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryContainer,
  },
  countPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  countPillTextSelected: {
    color: COLORS.primary,
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
