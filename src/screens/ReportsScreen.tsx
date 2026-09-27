import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { PlayerIdBadge } from '../components/PlayerIdBadge';
import { SlideUp } from '../components/AnimatedComponents';
import { getQuizService } from '../services/quizService';
import { ReportItem, Round, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { formatDateDisplay } from '../utils/formatters';

interface ReportsScreenProps {
  onNavigate: (tab: MainTab) => void;
  onOpenSettings: () => void;
}

type ReportFilter = 'overall' | 'by_round';

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ onNavigate, onOpenSettings }) => {
  const [filter, setFilter] = useState<ReportFilter>('overall');
  const [loading, setLoading] = useState(true);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);

  // Round selector for By Round filter
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');

  const loadRounds = useCallback(async () => {
    try {
      const service = await getQuizService();
      const rounds = await service.rounds.getAllRounds();
      setAllRounds(rounds);

      if (rounds.length > 0 && !selectedRoundId) {
        setSelectedRoundId(rounds[0].id);
      }
    } catch (err) {
      console.error('Failed to load rounds for reports:', err);
    }
  }, [selectedRoundId]);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    try {
      const service = await getQuizService();

      if (filter === 'overall') {
        const data = await service.reports.getOverallReport();
        setReportItems(data);
      } else if (filter === 'by_round') {
        if (selectedRoundId) {
          const data = await service.reports.getRoundReport(selectedRoundId);
          setReportItems(data);
        } else {
          setReportItems([]);
        }
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedRoundId]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handleSelectRound = (roundId: string) => {
    setSelectedRoundId(roundId);
  };

  const getScoreLabel = () => {
    if (filter === 'overall') return 'Overall Total Points';
    return 'Round Score';
  };

  return (
    <View style={styles.container}>
      <Header
        title="Reports"
        subtitle="Individual Player Rankings"
        onSettingsPress={onOpenSettings}
      />

      {/* FILTER TABS */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'overall' && styles.filterTabActive]}
          onPress={() => setFilter('overall')}
        >
          <Text style={[styles.filterTabText, filter === 'overall' && styles.filterTabTextActive]}>
            Overall
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'by_round' && styles.filterTabActive]}
          onPress={() => setFilter('by_round')}
        >
          <Text style={[styles.filterTabText, filter === 'by_round' && styles.filterTabTextActive]}>
            By Round
          </Text>
        </TouchableOpacity>
      </View>

      {/* SECONDARY SELECTOR FOR BY ROUND */}
      {filter === 'by_round' && allRounds.length > 0 && (
        <View style={styles.selectorsSection}>
          <Text style={styles.selectorLabel}>Select Round:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roundPillsScroll}
          >
            {allRounds.map((r) => {
              const isSelected = selectedRoundId === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roundPill, isSelected && styles.roundPillActive]}
                  onPress={() => handleSelectRound(r.id)}
                >
                  <Text style={[styles.roundPillText, isSelected && styles.roundPillTextActive]}>
                    {formatDateDisplay(r.round_date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* SCORE TYPE BANNER */}
      <View style={styles.scoreTypeBanner}>
        <Ionicons name="information-circle" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
        <Text style={styles.scoreTypeBannerText}>
          Showing: <Text style={{ fontWeight: '700' }}>{getScoreLabel()}</Text> (Ranked Highest → Lowest)
        </Text>
      </View>

      {/* REPORT LIST */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : reportItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="trophy-outline"
            title="No scores yet."
            description="Complete a round and enter scores to view the reports."
            actionText="Go to Round"
            onActionPress={() => onNavigate('round')}
          />
        </View>
      ) : (
        <FlatList
          data={reportItems}
          keyExtractor={(item) => item.player_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const isTop3 = item.rank <= 3;
            return (
              <SlideUp delay={Math.min(index * 50, 500)}>
                <View style={[styles.rankCard, isTop3 && styles.rankCardTop]}>
                  {/* Rank Badge */}
                <View
                  style={[
                    styles.rankBadge,
                    item.rank === 1 && styles.rankBadgeFirst,
                    item.rank === 2 && styles.rankBadgeSecond,
                    item.rank === 3 && styles.rankBadgeThird,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankText,
                      item.rank === 1 && styles.rankTextFirst,
                      item.rank === 2 && styles.rankTextSecond,
                      item.rank === 3 && styles.rankTextThird,
                    ]}
                  >
                    {item.rank}
                  </Text>
                </View>

                {/* Player Info */}
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {item.player_name}
                  </Text>
                  <PlayerIdBadge playerNumber={item.player_number} />
                </View>

                {/* Score Value */}
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreValue}>{item.score}</Text>
                  <Text style={styles.scoreUnit}>pts</Text>
                </View>
              </View>
            </SlideUp>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primaryContainer,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  selectorsSection: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  roundPillsScroll: {
    gap: 8,
    paddingRight: 16,
  },
  roundPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  roundPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roundPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  roundPillTextActive: {
    color: '#FFFFFF',
  },
  scoreTypeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scoreTypeBannerText: {
    fontSize: 12,
    color: COLORS.onPrimaryContainer,
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
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 8,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },
  rankCardTop: {
    borderColor: COLORS.primaryLight,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeFirst: {
    backgroundColor: '#FEF3C7', // Gold amber
  },
  rankBadgeSecond: {
    backgroundColor: '#E2E8F0', // Silver slate
  },
  rankBadgeThird: {
    backgroundColor: '#FFEDD5', // Bronze orange
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rankTextFirst: {
    color: '#B45309',
  },
  rankTextSecond: {
    color: '#475569',
  },
  rankTextThird: {
    color: '#C2410C',
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
  scoreBox: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  scoreUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
});
