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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { DuplicateConfirmModal } from '../components/DuplicateConfirmModal';
import { PlayerIdBadge } from '../components/PlayerIdBadge';
import { SlideUp } from '../components/AnimatedComponents';
import { SearchBar } from '../components/SearchBar';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { PlayerDetailModal } from './PlayerDetailModal';
import { getQuizService } from '../services/quizService';
import { Player, PlayerWithStats, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { pluralize } from '../utils/formatters';
import { validatePlayerName, validateScore } from '../utils/validation';
import { ExcelParseResult, readUploadedSpreadsheet } from '../utils/excelImport';
import { exportPlayersRosterToExcel } from '../utils/excelExport';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/errors';

interface PlayersScreenProps {
  onNavigate: (tab: MainTab) => void;
  onOpenSettings: () => void;
}

export const PlayersScreen: React.FC<PlayersScreenProps> = ({ onNavigate: _onNavigate, onOpenSettings }) => {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Player State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerScore, setNewPlayerScore] = useState('0');
  const [addError, setAddError] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Selected Player Details
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Excel Import State
  const [excelParseResult, setExcelParseResult] = useState<ExcelParseResult | null>(null);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pick and parse Excel/CSV spreadsheet
  const handlePickExcel = async () => {
    setIsPickingFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/comma-separated-values',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const parsed = await readUploadedSpreadsheet(file);
        if (!parsed.success && parsed.validRows.length === 0) {
          Alert.alert('Import Notice', parsed.error || 'No valid player rows found in spreadsheet.');
          return;
        }
        setExcelParseResult(parsed);
        setIsImportModalVisible(true);
      }
    } catch (err: any) {
      logError('File pick error:', err);
      Alert.alert('File Selection Failed', getErrorMessage(err, 'Could not access file.', 'PlayersScreen'));
    } finally {
      setIsPickingFile(false);
    }
  };

  // Execute Batch Player Import
  const handleConfirmExcelImport = async () => {
    if (!excelParseResult || excelParseResult.validRows.length === 0) return;
    try {
      const service = await getQuizService();
      const batchPayload = excelParseResult.validRows.map((r) => ({
        name: r.name,
        initialScore: r.initialScore,
      }));
      const res = await service.players.createPlayersBatch(batchPayload);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setIsImportModalVisible(false);
      setExcelParseResult(null);
      await loadPlayers('');
      Alert.alert(
        'Import Complete',
        `Successfully imported ${res.createdCount} ${pluralize(res.createdCount, 'player')} into the quiz system!`
      );
    } catch (err: any) {
      Alert.alert('Import Failed', getErrorMessage(err, 'Unable to import players.', 'PlayersScreen'));
    }
  };

  // Export Players Roster to Excel
  const handleExportPlayersToExcel = async () => {
    setIsExporting(true);
    try {
      const service = await getQuizService();
      const allPlayers = await service.players.searchPlayersWithStats('', true);
      if (allPlayers.length === 0) {
        Alert.alert('No Players', 'There are no active players to export.');
        return;
      }
      const res = await exportPlayersRosterToExcel(allPlayers);
      if (res.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else if (res.error) {
        Alert.alert('Export Error', res.error);
      }
    } catch (err: any) {
      logError('Player Excel export error:', err);
      Alert.alert('Export Failed', getErrorMessage(err, 'Unable to export players to Excel.', 'PlayersScreen'));
    } finally {
      setIsExporting(false);
    }
  };

  const loadPlayers = useCallback(async (query = searchQuery) => {
    try {
      const service = await getQuizService();
      const list = await service.players.searchPlayersWithStats(query, true);
      setPlayers(list);
    } catch (err) {
      logError('Failed to load players:', err);
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

    const scoreStr = newPlayerScore.trim() === '' ? '0' : newPlayerScore.trim();
    const scoreValidation = validateScore(scoreStr);
    if (!scoreValidation.isValid) {
      setAddError(scoreValidation.error || 'Invalid score');
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

      await service.players.createPlayer(validation.trimmedName, scoreValidation.points);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setNewPlayerName('');
      setNewPlayerScore('0');
      setAddError(null);
      setIsAddModalVisible(false);
      setShowDuplicateModal(false);
      loadPlayers('');
      setSearchQuery('');
    } catch (_err) {
      setAddError('Unable to save player. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Players"
        subtitle={`${players.length} registered ${pluralize(players.length, 'player')}`}
        onSettingsPress={onOpenSettings}
      />

      {/* SEARCH AND ACTION BAR */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search players..."
            showMatchCount={false}
            style={{ flex: 1 }}
          />

          <TouchableOpacity
            style={styles.addPlayerButton}
            onPress={() => {
              setNewPlayerName('');
              setNewPlayerScore('0');
              setAddError(null);
              setIsAddModalVisible(true);
            }}
            activeOpacity={0.8}
            accessibilityLabel="Add new player"
          >
            <Ionicons name="person-add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.addPlayerButtonText}>Add Player</Text>
          </TouchableOpacity>
        </View>

        {/* UTILITY ROW: FILTER STATUS OR ROSTER COUNT ON LEFT, EXCEL ACTIONS ON RIGHT */}
        <View style={styles.utilityRow}>
          <View style={styles.utilityLeft}>
            {searchQuery.trim().length > 0 ? (
              <View style={styles.filterStatsRow}>
                <Text style={styles.filterStatsText} numberOfLines={1}>
                  Found <Text style={{ fontWeight: '700', color: COLORS.primary }}>{players.length}</Text> {pluralize(players.length, 'player')}
                </Text>
                <TouchableOpacity
                  onPress={() => handleSearchChange('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.clearSearchLink}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.rosterCountText}>
                {players.length} registered {pluralize(players.length, 'player')}
              </Text>
            )}
          </View>

          <View style={styles.excelActionsGroup}>
            <TouchableOpacity
              style={styles.excelActionButton}
              onPress={handlePickExcel}
              disabled={isPickingFile || isExporting}
              activeOpacity={0.8}
              accessibilityLabel="Import players from Excel"
            >
              <Ionicons name="cloud-upload-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.excelActionButtonText}>
                {isPickingFile ? '...' : 'Import'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.excelActionButton}
              onPress={handleExportPlayersToExcel}
              disabled={isPickingFile || isExporting || players.length === 0}
              activeOpacity={0.8}
              accessibilityLabel="Export players to Excel"
            >
              <Ionicons name="cloud-download-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.excelActionButtonText}>
                {isExporting ? '...' : 'Export'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
              onActionPress={() => {
                setNewPlayerName('');
                setNewPlayerScore('0');
                setAddError(null);
                setIsAddModalVisible(true);
              }}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={players}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <SlideUp delay={Math.min(index * 50, 500)}>
              <TouchableOpacity
                style={styles.playerCard}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setSelectedPlayer(item);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <PlayerIdBadge playerNumber={item.player_number} />
                </View>

                <View style={styles.cardRight}>
                  <View style={styles.playerScoreBadge}>
                    <Text style={styles.playerScoreValue}>{item.total_score}</Text>
                    <Text style={styles.playerScoreUnit}>pts</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            </SlideUp>
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
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
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

            <Text style={styles.fieldLabel}>Default Score</Text>
            <View style={styles.scoreInputContainer}>
              <TextInput
                style={styles.scoreInput}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                value={newPlayerScore}
                onChangeText={(text) => {
                  setNewPlayerScore(text);
                  if (addError) setAddError(null);
                }}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={6}
              />
              <View style={styles.scorePresetsRow}>
                {[0, 5, 10, 15, 20].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.scorePresetPill,
                      newPlayerScore === String(preset) && styles.scorePresetPillActive,
                    ]}
                    onPress={() => {
                      setNewPlayerScore(String(preset));
                      if (addError) setAddError(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.scorePresetPillText,
                        newPlayerScore === String(preset) && styles.scorePresetPillTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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

      {/* EXCEL / CSV PLAYER IMPORT MODAL */}
      <ExcelImportModal
        visible={isImportModalVisible}
        parseResult={excelParseResult}
        onConfirmImport={handleConfirmExcelImport}
        onClose={() => {
          setIsImportModalVisible(false);
          setExcelParseResult(null);
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  utilityLeft: {
    flex: 1,
    marginRight: 8,
  },
  rosterCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  excelActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  excelActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
  },
  excelActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  addPlayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    minHeight: 46,
    borderRadius: 14,
    flexShrink: 0,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addPlayerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterStatsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  clearSearchLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 120, // For floating tab bar
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 120, // For floating tab bar
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
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  playerScoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onPrimaryContainer,
  },
  playerScoreUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
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
  scoreInputContainer: {
    marginBottom: 8,
  },
  scoreInput: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1.5,
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  scorePresetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  scorePresetPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePresetPillActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  scorePresetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  scorePresetPillTextActive: {
    color: COLORS.onPrimaryContainer,
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
