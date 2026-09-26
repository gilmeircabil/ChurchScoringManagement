import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Player, PlayerWithStats, PlayerScoreHistoryItem } from '../types';
import { COLORS } from '../constants/colors';
import { getQuizService } from '../services/quizService';
import { formatDateDisplay } from '../utils/formatters';
import { validatePlayerName, validateScore } from '../utils/validation';
import { DuplicateConfirmModal } from '../components/DuplicateConfirmModal';
import { ScoreModal } from '../components/ScoreModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { DestructiveConfirmModal } from '../components/DestructiveConfirmModal';
import { PlayerIdBadge } from '../components/PlayerIdBadge';
import { PendingScorePlaceholder } from '../components/PendingScorePlaceholder';

interface PlayerDetailModalProps {
  visible: boolean;
  player: Player | null;
  onClose: () => void;
  onPlayerUpdated: () => void;
  onPlayerDeleted?: () => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  visible,
  player,
  onClose,
  onPlayerUpdated,
  onPlayerDeleted,
}) => {
  const [stats, setStats] = useState<PlayerWithStats | null>(null);
  const [history, setHistory] = useState<PlayerScoreHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedInitialScore, setEditedInitialScore] = useState('0');
  const [editError, setEditError] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Score edit state
  const [editingScoreItem, setEditingScoreItem] = useState<PlayerScoreHistoryItem | null>(null);
  const [unlockConfirmItem, setUnlockConfirmItem] = useState<PlayerScoreHistoryItem | null>(null);

  const loadPlayerDetails = async (playerId: string) => {
    setLoading(true);
    try {
      const service = await getQuizService();
      const playerStats = await service.players.getPlayerWithStats(playerId);
      const scoreHistory = await service.players.getPlayerScoreHistory(playerId);
      setStats(playerStats);
      setHistory(scoreHistory);
    } catch (err) {
      console.error('Failed to load player details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && player) {
      setIsEditing(false);
      setEditedName(player.name);
      setEditedInitialScore(String(player.initial_score ?? 0));
      setEditError(null);
      loadPlayerDetails(player.id);
    }
  }, [visible, player]);

  const handleSaveName = async (forceDuplicate = false) => {
    if (!player) return;
    const validation = validatePlayerName(editedName);
    if (!validation.isValid) {
      setEditError(validation.error || 'Invalid name');
      return;
    }

    const scoreStr = editedInitialScore.trim() === '' ? '0' : editedInitialScore.trim();
    const scoreValidation = validateScore(scoreStr);
    if (!scoreValidation.isValid) {
      setEditError(scoreValidation.error || 'Invalid default score');
      return;
    }

    try {
      const service = await getQuizService();

      if (!forceDuplicate && validation.trimmedName.toLowerCase() !== player.name.toLowerCase()) {
        const existing = await service.players.findDuplicateNames(validation.trimmedName, player.id);
        if (existing.length > 0) {
          setShowDuplicateModal(true);
          return;
        }
      }

      await service.players.updatePlayer(player.id, validation.trimmedName, scoreValidation.points);
      setIsEditing(false);
      onPlayerUpdated();
      loadPlayerDetails(player.id);
    } catch (_err) {
      setEditError('Unable to update player details.');
    }
  };

  const handleEditHistoryScore = (item: PlayerScoreHistoryItem) => {
    if (item.round_status === 'LOCKED') {
      setUnlockConfirmItem(item);
    } else if (item.round_status === 'ACTIVE') {
      setEditingScoreItem(item);
    }
  };

  const handleUnlockAndEdit = async () => {
    if (!unlockConfirmItem) return;
    const target = unlockConfirmItem;
    setUnlockConfirmItem(null);
    try {
      const service = await getQuizService();
      await service.rounds.updateRoundStatus(target.round_id, 'ACTIVE');
      setEditingScoreItem({ ...target, round_status: 'ACTIVE' });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to unlock round.');
    }
  };

  const handleSaveHistoryScore = async (points: number) => {
    if (!player || !editingScoreItem) return;
    try {
      const service = await getQuizService();
      await service.scores.saveScore(editingScoreItem.round_id, player.id, points);
      setEditingScoreItem(null);
      await loadPlayerDetails(player.id);
      onPlayerUpdated();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save score.');
    }
  };

  // Delete player
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeletePlayer = async () => {
    if (!player) return;
    try {
      const service = await getQuizService();
      await service.players.deletePlayer(player.id);
      setShowDeleteConfirm(false);
      onPlayerUpdated();
      if (onPlayerDeleted) onPlayerDeleted();
      onClose();
    } catch (_err) {
      Alert.alert('Error', 'Unable to delete player.');
    }
  };

  if (!player) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {stats?.name || player.name}
              </Text>
              <PlayerIdBadge playerNumber={stats?.player_number || player.player_number} size="md" />
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Edit Name & Score section */}
          {isEditing ? (
            <View style={styles.editSection}>
              <Text style={styles.fieldLabel}>Player Name</Text>
              <TextInput
                style={[styles.input, editError ? styles.inputError : null]}
                value={editedName}
                onChangeText={(t) => {
                  setEditedName(t);
                  if (editError) setEditError(null);
                }}
                autoFocus
                placeholder="Enter player name"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Default / Starting Score</Text>
              <TextInput
                style={[styles.input, editError ? styles.inputError : null]}
                value={editedInitialScore}
                onChangeText={(t) => {
                  setEditedInitialScore(t);
                  if (editError) setEditError(null);
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                maxLength={6}
              />
              {editError && <Text style={styles.errorText}>{editError}</Text>}

              <View style={styles.editButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={() => {
                    setIsEditing(false);
                    setEditedName(player.name);
                    setEditedInitialScore(String(player.initial_score ?? 0));
                    setEditError(null);
                  }}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveEditButton}
                  onPress={() => handleSaveName(false)}
                >
                  <Text style={styles.saveEditText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editNameButton}
              onPress={() => {
                setEditedName(stats?.name || player.name);
                setEditedInitialScore(String(stats?.initial_score ?? player.initial_score ?? 0));
                setIsEditing(true);
              }}
            >
              <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
              <Text style={styles.editNameButtonText}>Edit Player</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
              {/* Stats Cards */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Score</Text>
                  <Text style={styles.statBigValue}>{stats?.total_score ?? 0}</Text>
                  <Text style={styles.statSubLabel}>Cumulative Points</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Rounds Played</Text>
                  <Text style={styles.statBigValue}>{stats?.rounds_played ?? 0}</Text>
                  <Text style={styles.statSubLabel}>Completed Sessions</Text>
                </View>

                {Boolean(stats?.initial_score && stats.initial_score > 0) && (
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Default Score</Text>
                    <Text style={[styles.statBigValue, { color: COLORS.secondary }]}>
                      {stats?.initial_score}
                    </Text>
                    <Text style={styles.statSubLabel}>Starting Points</Text>
                  </View>
                )}
              </View>

              {/* Score History */}
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>Score History</Text>

                {history.length === 0 ? (
                  <View style={styles.emptyHistory}>
                    <Text style={styles.emptyHistoryText}>
                      No round scores yet for this player.
                    </Text>
                  </View>
                ) : (
                  history.map((item) => (
                    <View key={item.score_id} style={styles.historyItem}>
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyDate}>
                          {formatDateDisplay(item.round_date)}
                        </Text>
                        <Text style={styles.historyGroup}>
                          {item.group_number ? `Group ${item.group_number}` : 'Unassigned'} •{' '}
                          {item.round_status}
                        </Text>
                      </View>
                      <View style={styles.historyRight}>
                        {item.round_status === 'DRAFT' ? (
                          <PendingScorePlaceholder size="md" />
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.historyPointsBadge}
                              onPress={() => handleEditHistoryScore(item)}
                              activeOpacity={0.7}
                              accessibilityLabel={`Score +${item.points}. Tap to edit`}
                            >
                              <Text style={styles.historyPointsText}>+{item.points}</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Delete Player */}
              <View style={styles.deleteContainer}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => setShowDeleteConfirm(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  <Text style={styles.deleteButtonText}>Delete Player</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* Edit Score Modal */}
          {editingScoreItem && (
            <ScoreModal
              visible={Boolean(editingScoreItem)}
              title="Edit Round Score"
              subtitle={`Round: ${formatDateDisplay(editingScoreItem.round_date)}`}
              playerName={stats?.name || player.name}
              playerNumber={stats?.player_number || player.player_number}
              currentScore={editingScoreItem.points}
              onSave={handleSaveHistoryScore}
              onClose={() => setEditingScoreItem(null)}
            />
          )}

          {/* Unlock Round Confirmation Modal */}
          <ConfirmationModal
            visible={Boolean(unlockConfirmItem)}
            title="Unlock Round?"
            message={`This round (${unlockConfirmItem ? formatDateDisplay(unlockConfirmItem.round_date) : ''}) is locked.`}
            subMessage="Unlock this round to edit the score?"
            confirmText="Unlock & Edit"
            cancelText="Cancel"
            iconName="lock-open-outline"
            onConfirm={handleUnlockAndEdit}
            onCancel={() => setUnlockConfirmItem(null)}
          />

          {/* Duplicate Name Confirmation Modal for Edit */}
          <DuplicateConfirmModal
            visible={showDuplicateModal}
            playerName={editedName.trim()}
            actionType="edit"
            onConfirmAddAnother={() => {
              setShowDuplicateModal(false);
              handleSaveName(true);
            }}
            onChangeName={() => setShowDuplicateModal(false)}
            onCancel={() => setShowDuplicateModal(false)}
          />

          {/* Delete Player Confirmation */}
          <DestructiveConfirmModal
            visible={showDeleteConfirm}
            title="Delete Player?"
            message={`This will permanently delete ${stats?.name || player.name} and all their score history. This action cannot be undone.`}
            confirmWord="DELETE"
            onConfirm={handleDeletePlayer}
            onCancel={() => setShowDeleteConfirm(false)}
            iconName="trash-outline"
          />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceVariant,
  },
  editNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 12,
  },
  editNameButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  editSection: {
    backgroundColor: COLORS.surfaceVariant,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 4,
  },
  editButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelEditButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  cancelEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  saveEditButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveEditText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceVariant,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statBigValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    marginVertical: 4,
  },
  statSubLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  historySection: {
    marginTop: 8,
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  emptyHistory: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  historyGroup: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyPointsBadge: {
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  historyPointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
  deleteContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 20,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerContainer,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
