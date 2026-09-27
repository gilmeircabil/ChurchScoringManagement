import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { DestructiveConfirmModal } from '../components/DestructiveConfirmModal';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { StatusBanner, StatusMessage } from '../components/StatusBanner';
import { SlideUp } from '../components/AnimatedComponents';
import { RoundDetailModal } from './RoundDetailModal';
import { getQuizService } from '../services/quizService';
import { RoundHistoryItem, Round, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { formatDateDisplay, pluralize } from '../utils/formatters';

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

  // Clear history state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<StatusMessage>(null);

  const loadHistory = useCallback(async () => {
    try {
      const service = await getQuizService();
      const list = await service.rounds.getRoundHistoryList();
      setHistoryList(list);
    } catch (err) {
      console.error('Failed to load round history:', err);
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
      console.error('Failed to load round:', err);
    }
  };

  // Only open the confirmation when nothing is in progress
  const handleClearHistoryPress = async () => {
    setClearMessage(null);
    try {
      const service = await getQuizService();
      const active = await service.rounds.getActiveRound();
      if (active) {
        setClearMessage({
          type: 'error',
          text: 'A round is currently in progress. Lock or finish it before clearing history.',
        });
        return;
      }
      if (historyList.length === 0) {
        return;
      }
      setShowClearConfirm(true);
    } catch (err: any) {
      setClearMessage({ type: 'error', text: err.message || 'Unable to check the current round.' });
    }
  };

  const handleConfirmClearHistory = async () => {
    setClearing(true);
    setShowClearConfirm(false);
    try {
      const service = await getQuizService();
      const removed = await service.rounds.clearHistory();
      setSelectedRound(null);
      setClearMessage({
        type: 'success',
        text: `Cleared ${removed} ${removed === 1 ? 'round' : 'rounds'} and all their scores. Players were kept.`,
      });
      await loadHistory();
    } catch (err: any) {
      setClearMessage({ type: 'error', text: err.message || 'Failed to clear history.' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="History"
        subtitle={`${historyList.length} past ${pluralize(historyList.length, 'round')}`}
        onSettingsPress={onOpenSettings}
      />

      <View style={styles.actionBar}>
        <StatusBanner message={clearMessage} style={{ marginBottom: 12 }} />

        <TouchableOpacity
          style={styles.clearHistoryButton}
          onPress={handleClearHistoryPress}
          disabled={clearing || historyList.length === 0}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
          <Text style={styles.clearHistoryButtonText}>Clear History</Text>
        </TouchableOpacity>
      </View>

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
                    <Text style={styles.roundDate}>{formatDateDisplay(item.round_date)}</Text>
                    <RoundStatusBadge status={item.status} />
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

      {/* CLEAR HISTORY CONFIRMATION MODAL */}
      <DestructiveConfirmModal
        visible={showClearConfirm}
        iconName="trash-outline"
        title="Clear History?"
        message="This will permanently erase all rounds, groups, and score records. Players and their starting scores will be kept. This cannot be undone."
        confirmWord="DELETE"
        onConfirm={handleConfirmClearHistory}
        onCancel={() => setShowClearConfirm(false)}
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
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  clearHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    backgroundColor: COLORS.dangerContainer,
    borderWidth: 1,
    borderColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  clearHistoryButtonText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
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
