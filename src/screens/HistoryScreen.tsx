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
import { RoundDetailModal } from './RoundDetailModal';
import { getQuizService } from '../services/quizService';
import { RoundHistoryItem, Round, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { formatDateDisplay } from '../utils/formatters';

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

  return (
    <View style={styles.container}>
      <Header
        title="History"
        subtitle={`${historyList.length} past ${historyList.length === 1 ? 'round' : 'rounds'}`}
        onSettingsPress={onOpenSettings}
      />

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
          renderItem={({ item }) => {
            const isLocked = item.status === 'LOCKED';
            const isActive = item.status === 'ACTIVE';

            return (
              <TouchableOpacity
                style={styles.roundCard}
                onPress={() => handleRoundPress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.roundDate}>{formatDateDisplay(item.round_date)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isLocked && styles.badgeLocked,
                      isActive && styles.badgeActive,
                      item.status === 'DRAFT' && styles.badgeDraft,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isLocked && styles.statusTextLocked,
                        isActive && styles.statusTextActive,
                        item.status === 'DRAFT' && styles.statusTextDraft,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
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
            );
          }}
        />
      )}

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
    paddingBottom: 40,
  },
  listContent: {
    padding: 16,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeLocked: {
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  badgeActive: {
    backgroundColor: COLORS.successContainer,
  },
  badgeDraft: {
    backgroundColor: COLORS.warningContainer,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextLocked: {
    color: COLORS.textSecondary,
  },
  statusTextActive: {
    color: COLORS.onSuccessContainer,
  },
  statusTextDraft: {
    color: COLORS.onWarningContainer,
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
