import React, { useState, useEffect } from 'react';
import { BlurView } from 'expo-blur';
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
import { Round, GroupDetail } from '../types';
import { COLORS } from '../constants/colors';
import { formatDateDisplay, pluralize } from '../utils/formatters';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ScoreModal } from '../components/ScoreModal';
import { GroupItemsModal } from '../components/GroupItemsModal';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { PlayerIdBadge } from '../components/PlayerIdBadge';

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
  const [scoringGroup, setScoringGroup] = useState<GroupDetail | null>(null);
  const [selectedGroupForItems, setSelectedGroupForItems] = useState<GroupDetail | null>(null);

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

  const handleSaveGroupScore = async (points: number) => {
    if (!round || !scoringGroup) return;
    try {
      const service = await getQuizService();
      await service.scores.saveGroupScore(round.id, scoringGroup.id, points);
      setScoringGroup(null);
      loadDetails(round.id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save group score.');
    }
  };

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
      loadDetails(round.id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update group items.');
    }
  };

  if (!round) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.dragHandle} />
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
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupTitle} numberOfLines={1}>
                        GROUP {group.group_number}{group.name ? ` — ${group.name}` : ''}
                      </Text>
                      <Text style={styles.groupCount}>
                        {group.members.length} {pluralize(group.members.length, 'player')}
                      </Text>
                    </View>

                    {round.status !== 'DRAFT' && (
                      <View style={styles.groupTotalBadge}>
                        <Text style={styles.groupTotalBadgeLabel}>TOTAL</Text>
                        <Text style={styles.groupTotalBadgeValue}>{group.total_score}</Text>
                        <Text style={styles.groupTotalBadgePts}>pts</Text>
                      </View>
                    )}
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
                      </View>
                    ))
                  )}

                  {/* Group Items Bonus Footer */}
                  {round.status !== 'DRAFT' && (
                    <View style={styles.groupDetailFooter}>
                      <View style={styles.groupDetailBreakdown}>
                        <View style={styles.groupDetailScoreControls}>
                          <TouchableOpacity
                            style={[
                              styles.groupDetailQuizBadge,
                              round.status === 'ACTIVE' && styles.groupDetailQuizBadgeActive,
                            ]}
                            onPress={() => {
                              if (round.status === 'LOCKED') {
                                setShowUnlockConfirm(true);
                              } else {
                                setScoringGroup(group);
                              }
                            }}
                            activeOpacity={0.7}
                            accessibilityLabel={`Quiz score: ${group.quiz_score ?? 0} points. Tap to edit`}
                          >
                            <Ionicons name="school-outline" size={13} color={COLORS.primary} />
                            <Text style={styles.groupDetailQuizText}>
                              Quiz: {group.quiz_score ?? 0} pts
                            </Text>
                            {round.status === 'ACTIVE' && (
                              <Ionicons name="pencil" size={11} color={COLORS.primary} style={{ marginLeft: 2 }} />
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.groupDetailItemsBtn}
                            onPress={() => {
                              if (round.status === 'LOCKED') {
                                setShowUnlockConfirm(true);
                              } else {
                                setSelectedGroupForItems(group);
                              }
                            }}
                          >
                            <Ionicons
                              name={round.status === 'LOCKED' ? 'lock-closed' : 'pricetag'}
                              size={12}
                              color={COLORS.primary}
                            />
                            <Text style={styles.groupDetailItemsBtnText}>
                              {round.status === 'LOCKED'
                                ? `Items: +${group.items_bonus} pts`
                                : group.items_bonus > 0
                                ? `Items (+${group.items_bonus})`
                                : '+ Add Items'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {group.items_bonus > 0 && (
                          <Text style={styles.groupDetailItemsSummary}>
                            📖 {group.book_count} {group.book_name || 'Book'} • 🖊️ {group.pen_count} {group.pen_name || 'Pen'} • 📄 {group.paper_count} {group.paper_name || 'Paper'}
                          </Text>
                        )}
                      </View>
                    </View>
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

          {/* Edit Group Score Modal */}
          {scoringGroup && (
            <ScoreModal
              visible={Boolean(scoringGroup)}
              title="Edit Group Score"
              subtitle={`Round: ${formatDateDisplay(round.round_date)}`}
              groupNumber={scoringGroup.group_number}
              groupName={scoringGroup.name}
              currentScore={scoringGroup.quiz_score ?? 0}
              onSave={handleSaveGroupScore}
              onClose={() => setScoringGroup(null)}
            />
          )}

          {/* Group Items Bonus Modal */}
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
              isLocked={round.status === 'LOCKED'}
              onSave={handleSaveGroupItems}
              onClose={() => setSelectedGroupForItems(null)}
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
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '88%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: COLORS.borderDark,
    alignSelf: 'center',
    marginBottom: 16,
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
  groupTotalBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  groupTotalBadgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 4,
    textTransform: 'uppercase',
  },
  groupTotalBadgeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  groupTotalBadgePts: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryLight,
    marginLeft: 2,
  },
  groupDetailFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupDetailBreakdown: {
    flex: 1,
    marginRight: 8,
  },
  groupDetailScoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  groupDetailQuizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  groupDetailQuizBadgeActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  groupDetailQuizText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  groupDetailBreakdownText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  groupDetailItemsSummary: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  groupDetailItemsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  groupDetailItemsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
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
