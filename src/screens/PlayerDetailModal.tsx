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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Player, PlayerWithStats, PlayerScoreHistoryItem } from '../types';
import { COLORS } from '../constants/colors';
import { getQuizService } from '../services/quizService';
import { formatPlayerIdentifier, formatDateDisplay } from '../utils/formatters';
import { validatePlayerName } from '../utils/validation';
import { DuplicateConfirmModal } from '../components/DuplicateConfirmModal';

interface PlayerDetailModalProps {
  visible: boolean;
  player: Player | null;
  onClose: () => void;
  onPlayerUpdated: () => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  visible,
  player,
  onClose,
  onPlayerUpdated,
}) => {
  const [stats, setStats] = useState<PlayerWithStats | null>(null);
  const [history, setHistory] = useState<PlayerScoreHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  useEffect(() => {
    if (visible && player) {
      setIsEditing(false);
      setEditedName(player.name);
      setEditError(null);
      loadPlayerDetails(player.id);
    }
  }, [visible, player]);

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

  const handleSaveName = async (forceDuplicate = false) => {
    if (!player) return;
    const validation = validatePlayerName(editedName);
    if (!validation.isValid) {
      setEditError(validation.error || 'Invalid name');
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

      await service.players.updatePlayerName(player.id, validation.trimmedName);
      setIsEditing(false);
      onPlayerUpdated();
      loadPlayerDetails(player.id);
    } catch (err) {
      setEditError('Unable to update player name.');
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
              <View style={styles.idBadge}>
                <Text style={styles.idText}>
                  {formatPlayerIdentifier(stats?.player_number || player.player_number)}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Edit Name section */}
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
              {editError && <Text style={styles.errorText}>{editError}</Text>}

              <View style={styles.editButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={() => {
                    setIsEditing(false);
                    setEditedName(player.name);
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
                setIsEditing(true);
              }}
            >
              <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
              <Text style={styles.editNameButtonText}>Edit Name</Text>
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
                  history.map((item, idx) => (
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
                      <View style={styles.historyPointsBadge}>
                        <Text style={styles.historyPointsText}>+{item.points}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}

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
  idBadge: {
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  idText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
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
  historyPointsBadge: {
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyPointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
});
