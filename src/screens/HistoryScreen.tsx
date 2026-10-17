import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { StatusBanner, StatusMessage } from '../components/StatusBanner';
import { SlideUp } from '../components/AnimatedComponents';
import { RoundDetailModal } from './RoundDetailModal';
import { getQuizService } from '../services/quizService';
import { RoundHistoryItem, Round, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { formatDateDisplay, pluralize } from '../utils/formatters';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/errors';

interface HistoryScreenProps {
  onNavigate: (tab: MainTab) => void;
  onOpenSettings: () => void;
  onSelectRoundForScreen: (roundId: string) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onNavigate,
  onOpenSettings,
  onSelectRoundForScreen,
}) => {
  const [historyList, setHistoryList] = useState<RoundHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);

  // Single round delete state
  const [roundToDelete, setRoundToDelete] = useState<RoundHistoryItem | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const service = await getQuizService();
      const list = await service.rounds.getRoundHistoryList();
      setHistoryList(list);
    } catch (err) {
      logError('Failed to load round history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleRoundPress = async (roundItem: RoundHistoryItem) => {
    try {
      const service = await getQuizService();
      const fullRound = await service.rounds.getRoundById(roundItem.id);
      setSelectedRound(fullRound);
    } catch (err) {
      logError('Failed to load round:', err);
    }
  };

  const handleConfirmDeleteRound = async () => {
    if (!roundToDelete) return;
    const target = roundToDelete;
    setRoundToDelete(null);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Optimistic removal from state for instant responsiveness
    setHistoryList((prev) => prev.filter((r) => r.id !== target.id));
    try {
      const service = await getQuizService();
      await service.rounds.deleteRound(target.id);
      setStatusMessage({
        type: 'success',
        text: `Round from ${formatDateDisplay(target.round_date)} deleted.`,
      });
      await loadHistory();
    } catch (err: any) {
      await loadHistory();
      setStatusMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to delete round.', 'HistoryScreen'),
      });
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="History"
        subtitle={`${historyList.length} past ${pluralize(historyList.length, 'round')}`}
        onSettingsPress={onOpenSettings}
      />

      {statusMessage && (
        <View style={styles.statusBannerWrapper}>
          <StatusBanner message={statusMessage} />
        </View>
      )}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : historyList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="time-outline"
            title="No previous rounds yet."
            description="Created rounds and completed game sessions will appear here."
            actionText="Go to Round"
            onActionPress={() => onNavigate('round')}
          />
        </View>
      ) : (
        <FlatList
          data={historyList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          renderItem={({ item, index }) => {
            return (
              <SlideUp delay={Math.min(index * 50, 500)}>
                <TouchableOpacity
                  style={styles.roundCard}
                  onPress={() => handleRoundPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.roundDate}>{formatDateDisplay(item.round_date)}</Text>
                      <RoundStatusBadge status={item.status} />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteCardButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setRoundToDelete(item);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={`Delete round from ${formatDateDisplay(item.round_date)}`}
                    >
                      <Ionicons name="trash-outline" size={17} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardDetailsRow}>
                    <View style={styles.detailItem}>
                      <Ionicons name="people-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.detailText}>
                        {item.assigned_count} Assigned Players
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Ionicons name="grid-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.detailText}>{item.group_count} Groups</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </SlideUp>
            );
          }}
        />
      )}

      {/* DELETE SINGLE ROUND CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={Boolean(roundToDelete)}
        title="Delete Round"
        message={
          roundToDelete
            ? `Are you sure you want to delete the round from ${formatDateDisplay(roundToDelete.round_date)}?`
            : ''
        }
        subMessage="All scores and group assignments for this round will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        iconName="trash-outline"
        onConfirm={handleConfirmDeleteRound}
        onCancel={() => setRoundToDelete(null)}
      />

      {/* ROUND DETAIL MODAL */}
      <RoundDetailModal
        visible={Boolean(selectedRound)}
        round={selectedRound}
        onClose={() => setSelectedRound(null)}
        onSelectWorkingRound={(roundId) => {
          setSelectedRound(null);
          onSelectRoundForScreen(roundId);
          onNavigate('round');
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
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 120,
  },
  statusBannerWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  roundCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  deleteCardButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.dangerContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDate: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
