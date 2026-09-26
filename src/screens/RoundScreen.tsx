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
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { ScoreModal } from '../components/ScoreModal';
import { AssignGroupModal } from '../components/AssignGroupModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { UnassignedListModal } from '../components/UnassignedListModal';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { PlayerIdBadge } from '../components/PlayerIdBadge';
import { PendingScorePlaceholder } from '../components/PendingScorePlaceholder';
import { getQuizService } from '../services/quizService';
import { Round, Group, GroupDetail, AssignedMember, Player, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { APP_CONFIG } from '../constants/config';
import { formatDateDisplay, getTodayISODate, pluralize } from '../utils/formatters';
import { validateGroupCount } from '../utils/validation';

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

  // Scoring Modal
  const [scoringMember, setScoringMember] = useState<AssignedMember | null>(null);

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
      const service = await getQuizService();
      const newRound = await service.rounds.createRound(newRoundDate.trim(), groupCountNum);
      setIsNewRoundModalVisible(false);
      setNewRoundError(null);
      loadRoundData(newRound.id);
    } catch (_err) {
      setNewRoundError('Failed to create round.');
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
      setIsUnlockConfirmVisible(false);
      loadRoundData(round.id);
    } catch (_err) {
      Alert.alert('Error', 'Unable to unlock round.');
    }
  };

  // Save Score
  const handleSaveScore = async (points: number) => {
    if (!round || !scoringMember) return;
    if (round.status !== 'ACTIVE') return;
    try {
      const service = await getQuizService();
      await service.scores.saveScore(round.id, scoringMember.player_id, points);
      setScoringMember(null);
      loadRoundData(round.id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save score.');
    }
  };

  // Quick Stepper for round score (+5, -5)
  const handleQuickStepScore = async (member: AssignedMember, delta: number) => {
    if (!round || round.status !== 'ACTIVE') return;
    const currentScore = member.round_score || 0;
    const newScore = Math.max(0, currentScore + delta);
    if (newScore === currentScore && delta < 0) return;

    // Optimistically update groupDetails state for instant UI feedback
    setGroupDetails((prev) =>
      prev.map((g) => ({
        ...g,
        members: g.members.map((m) =>
          m.player_id === member.player_id ? { ...m, round_score: newScore } : m
        ),
      }))
    );

    try {
      const service = await getQuizService();
      await service.scores.saveScore(round.id, member.player_id, newScore);
      loadRoundData(round.id);
    } catch (err: any) {
      loadRoundData(round.id);
      Alert.alert('Error', err.message || 'Unable to update score.');
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
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Search player to assign/move..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoCapitalize="words"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* SEARCH RESULTS DROPDOWN */}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsBox}>
                <Text style={styles.searchResultsTitle}>Select player to assign:</Text>
                {searchResults.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.searchResultItem}
                    onPress={() => handlePlayerTap(p)}
                  >
                    <Text style={styles.searchResultName}>{p.name}</Text>
                    <PlayerIdBadge playerNumber={p.player_number} />
                  </TouchableOpacity>
                ))}
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
                <Text style={styles.groupHeaderTitle}>GROUP {group.group_number}</Text>
                <Text style={styles.groupMemberCount}>
                  {group.members.length} {pluralize(group.members.length, 'player')}
                </Text>
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

                      {/* SCORING CONTROLS — ONLY WHILE THE ROUND IS ACTIVE */}
                      {isActive ? (
                        <View style={styles.scoreActionRow}>
                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleQuickStepScore(member, -5)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            accessibilityLabel="Subtract 5 points"
                          >
                            <Ionicons name="remove" size={14} color={COLORS.textSecondary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.scorePill}
                            onPress={() => setScoringMember(member)}
                            activeOpacity={0.7}
                            accessibilityLabel={`Score: ${member.round_score} points. Tap to edit`}
                          >
                            <Text style={styles.scorePillValue}>{member.round_score}</Text>
                            <Text style={styles.scorePillLabel}>pts</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.stepperButton}
                            onPress={() => handleQuickStepScore(member, 5)}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            accessibilityLabel="Add 5 points"
                          >
                            <Ionicons name="add" size={14} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      ) : isLocked ? (
                        <TouchableOpacity
                          style={styles.lockedScoreBadge}
                          onPress={() => setIsUnlockConfirmVisible(true)}
                          activeOpacity={0.7}
                          accessibilityLabel="Score locked. Tap to unlock round"
                        >
                          <Ionicons name="lock-closed" size={11} color={COLORS.onSecondaryContainer} style={{ marginRight: 4 }} />
                          <Text style={styles.lockedScoreText}>+{member.round_score}</Text>
                        </TouchableOpacity>
                      ) : (
                        <PendingScorePlaceholder />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* BOTTOM ACTION BUTTONS */}
        <View style={styles.bottomActions}>
          {isDraft && (
            <TouchableOpacity style={styles.startRoundButton} onPress={handleStartRound}>
              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.startRoundButtonText}>Start Round</Text>
            </TouchableOpacity>
          )}

          {isActive && (
            <TouchableOpacity
              style={styles.lockRoundButton}
              onPress={() => setIsLockConfirmVisible(true)}
            >
              <Ionicons name="lock-closed" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.lockRoundButtonText}>Finish & Lock Round</Text>
            </TouchableOpacity>
          )}

          {isLocked && (
            <TouchableOpacity
              style={styles.unlockRoundButton}
              onPress={() => setIsUnlockConfirmVisible(true)}
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

      {/* SCORE ENTRY MODAL */}
      {scoringMember && (
        <ScoreModal
          visible={Boolean(scoringMember)}
          playerName={scoringMember.player_name}
          playerNumber={scoringMember.player_number}
          currentScore={scoringMember.round_score}
          onSave={handleSaveScore}
          onClose={() => setScoringMember(null)}
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
    paddingBottom: 36,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    padding: 0,
  },
  searchResultsBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    marginTop: 6,
    padding: 10,
    maxHeight: 200,
    elevation: 4,
  },
  searchResultsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
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
  scoreActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 44,
    justifyContent: 'center',
  },
  scorePillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  scorePillLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
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
  bottomActions: {
    marginTop: 24,
  },
  startRoundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 3,
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
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 3,
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
    borderRadius: 12,
  },
  unlockRoundButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
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
