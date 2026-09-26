import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getQuizService } from '../services/quizService';
import { Round, GroupDetail, AssignedMember } from '../types';
import { COLORS } from '../constants/colors';
import { formatDateDisplay, pluralize } from '../utils/formatters';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ScoreModal } from '../components/ScoreModal';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { PlayerIdBadge } from '../components/PlayerIdBadge';
import { PendingScorePlaceholder } from '../components/PendingScorePlaceholder';

interface RoundDetailModalProps {
  visible: boolean;
  round: Round | null;
  onClose: () => void;
  onSelectWorkingRound: (roundId: string) => void;
}

export const RoundDetailModal: React.FC<RoundDetailModalProps> = ({
  visible,
  round,
  onClose,
  onSelectWorkingRound,
}) => {
  const [loading, setLoading] = useState(false);
  const [groupDetails, setGroupDetails] = useState<GroupDetail[]>([]);
  const [counts, setCounts] = useState<{
    totalPlayers: number;
    assignedCount: number;
    unassignedCount: number;
  }>({ totalPlayers: 0, assignedCount: 0, unassignedCount: 0 });
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [scoringMember, setScoringMember] = useState<AssignedMember | null>(null);

  const loadDetails = async (roundId: string) => {
    setLoading(true);
    try {
      const service = await getQuizService();
      const details = await service.groups.getGroupDetails(roundId);
      const roundCounts = await service.groups.getCountsForRound(roundId);
      setGroupDetails(details);
      setCounts(roundCounts);
    } catch (err) {
      console.error('Failed to load round details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && round) {
      loadDetails(round.id);
    }
  }, [visible, round]);

  const handleUnlockRound = async () => {
    if (!round) return;
    try {
      const service = await getQuizService();
      await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
      setShowUnlockConfirm(false);
      onClose();
      onSelectWorkingRound(round.id);
    } catch (_err) {
      Alert.alert('Error', 'Unable to unlock round.');
    }
  };

  const handleSaveScore = async (points: number) => {
    if (!round || !scoringMember) return;
    try {
      const service = await getQuizService();
      await service.scores.saveScore(round.id, scoringMember.player_id, points);
      setScoringMember(null);
      loadDetails(round.id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save score.');
    }
  };

  if (!round) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{formatDateDisplay(round.round_date)}</Text>
              <View style={styles.statusRow}>
                <RoundStatusBadge status={round.status} />
                <Text style={styles.summaryText}>
                  {round.group_count} Groups • {counts.assignedCount} Players
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
              {groupDetails.map((group) => (
                <View key={group.id} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>GROUP {group.group_number}</Text>
                  <Text style={styles.groupCount}>
                    {group.members.length} {pluralize(group.members.length, 'player')}
                  </Text>

                  </View>

                  {group.members.length === 0 ? (
                    <Text style={styles.emptyGroup}>No players in this group</Text>
                  ) : (
                    group.members.map((member) => (
                      <View key={member.group_member_id} style={styles.memberRow}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {member.player_name}
                          </Text>
                          <PlayerIdBadge playerNumber={member.player_number} />
                        </View>
                        {round.status === 'DRAFT' ? (
                          <PendingScorePlaceholder />
                        ) : (
                          <View style={styles.scoreActionRow}>
                            <TouchableOpacity
                              style={styles.scoreBadge}
                              onPress={() => {
                                if (round.status === 'LOCKED') {
                                  setShowUnlockConfirm(true);
                                } else {
                                  setScoringMember(member);
                                }
                              }}
                              activeOpacity={0.7}
                              accessibilityLabel={`Score +${member.round_score}. Tap to edit`}
                            >
                              <Text style={styles.scoreText}>+{member.round_score}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Action Row */}
          <View style={styles.footerRow}>
            {round.status === 'LOCKED' ? (
              <TouchableOpacity
                style={styles.unlockButton}
                onPress={() => setShowUnlockConfirm(true)}
              >
                <Ionicons name="lock-open-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.unlockButtonText}>Unlock Round to Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.workingRoundButton}
                onPress={() => {
                  onClose();
                  onSelectWorkingRound(round.id);
                }}
              >
                <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.workingRoundButtonText}>Open in Round Manager</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Unlock Confirmation Modal */}
          <ConfirmationModal
            visible={showUnlockConfirm}
            title="Unlock Round?"
            message="Unlock this round to make changes to groups or scores?"
            confirmText="Unlock"
            cancelText="Cancel"
            iconName="lock-open-outline"
            onConfirm={handleUnlockRound}
            onCancel={() => setShowUnlockConfirm(false)}
          />

          {/* Edit Score Modal */}
          {scoringMember && (
            <ScoreModal
              visible={Boolean(scoringMember)}
              title="Edit Round Score"
              subtitle={`Round: ${formatDateDisplay(round.round_date)}`}
              playerName={scoringMember.player_name}
              playerNumber={scoringMember.player_number}
              currentScore={scoringMember.round_score}
              onSave={handleSaveScore}
              onClose={() => setScoringMember(null)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  summaryText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceVariant,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 20,
    gap: 12,
  },
  groupCard: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  groupCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyGroup: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 6,
  },
  scoreActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBadge: {
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
  footerRow: {
    marginTop: 12,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  workingRoundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  workingRoundButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
