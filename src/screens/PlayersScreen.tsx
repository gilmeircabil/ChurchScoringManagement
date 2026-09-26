import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { DuplicateConfirmModal } from '../components/DuplicateConfirmModal';
import { PlayerDetailModal } from './PlayerDetailModal';
import { getQuizService } from '../services/quizService';
import { Player, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { formatPlayerIdentifier } from '../utils/formatters';
import { validatePlayerName } from '../utils/validation';

interface PlayersScreenProps {
  onNavigate: (tab: MainTab) => void;
  onOpenSettings: () => void;
}

export const PlayersScreen: React.FC<PlayersScreenProps> = ({ onNavigate, onOpenSettings }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Player State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Selected Player Details
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const loadPlayers = useCallback(async (query = searchQuery) => {
    try {
      const service = await getQuizService();
      const list = await service.players.searchPlayers(query, true);
      setPlayers(list);
    } catch (err) {
      console.error('Failed to load players:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    loadPlayers(text);
  };

  const handleSavePlayer = async (forceDuplicate = false) => {
    const validation = validatePlayerName(newPlayerName);
    if (!validation.isValid) {
      setAddError(validation.error || 'Invalid name');
      return;
    }

    try {
      const service = await getQuizService();

      if (!forceDuplicate) {
        const existing = await service.players.findDuplicateNames(validation.trimmedName);
        if (existing.length > 0) {
          setShowDuplicateModal(true);
          return;
        }
      }

      await service.players.createPlayer(validation.trimmedName);
      setNewPlayerName('');
      setAddError(null);
      setIsAddModalVisible(false);
      setShowDuplicateModal(false);
      loadPlayers('');
      setSearchQuery('');
    } catch (err) {
      setAddError('Unable to save player. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Players"
        subtitle={`${players.length} registered ${players.length === 1 ? 'player' : 'players'}`}
        onSettingsPress={onOpenSettings}
      />

      {/* SEARCH AND ADD BAR */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search player..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.addPlayerButton}
          onPress={() => {
            setNewPlayerName('');
            setAddError(null);
            setIsAddModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.addPlayerButtonText}>Add Player</Text>
        </TouchableOpacity>
      </View>

      {/* PLAYERS LIST */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : players.length === 0 ? (
        <View style={styles.emptyContainer}>
          {searchQuery.trim().length > 0 ? (
            <EmptyState
              iconName="search-outline"
              title="No players found"
              description={`No players matching "${searchQuery}".`}
              actionText="Clear Search"
              onActionPress={() => handleSearchChange('')}
            />
          ) : (
            <EmptyState
              iconName="people-outline"
              title="No players yet."
              description="Add your first player to get started with quiz rounds."
              actionText="Add Player"
              onActionPress={() => setIsAddModalVisible(true)}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={players}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.playerCard}
              onPress={() => setSelectedPlayer(item)}
              activeOpacity={0.7}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.idBadge}>
                  <Text style={styles.idText}>
                    {formatPlayerIdentifier(item.player_number)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ADD PLAYER MODAL */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.addModalCard}>
            <Text style={styles.addModalTitle}>Add Player</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={[styles.nameInput, addError ? styles.nameInputError : null]}
              placeholder="e.g. John"
              placeholderTextColor={COLORS.textMuted}
              value={newPlayerName}
              onChangeText={(text) => {
                setNewPlayerName(text);
                if (addError) setAddError(null);
              }}
              autoFocus
              autoCapitalize="words"
            />
            {addError && <Text style={styles.errorText}>{addError}</Text>}

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsAddModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.savePlayerButton}
                onPress={() => handleSavePlayer(false)}
              >
                <Text style={styles.savePlayerButtonText}>Save Player</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DUPLICATE NAME CONFIRMATION MODAL */}
      <DuplicateConfirmModal
        visible={showDuplicateModal}
        playerName={newPlayerName.trim()}
        actionType="add"
        onConfirmAddAnother={() => {
          setShowDuplicateModal(false);
          handleSavePlayer(true);
        }}
        onChangeName={() => {
          setShowDuplicateModal(false);
        }}
        onCancel={() => {
          setShowDuplicateModal(false);
          setIsAddModalVisible(false);
        }}
      />

      {/* PLAYER DETAIL MODAL */}
      <PlayerDetailModal
        visible={Boolean(selectedPlayer)}
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onPlayerUpdated={() => {
          loadPlayers();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchSection: {
    padding: 16,
    paddingBottom: 8,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
  },
  addPlayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 2,
  },
  addPlayerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  idBadge: {
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  idText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  addModalTitle: {
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
  nameInput: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  nameInputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerContainer,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  addModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  savePlayerButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  savePlayerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
