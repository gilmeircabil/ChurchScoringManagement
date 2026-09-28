import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '../utils/haptics';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { RoundStatusBadge } from '../components/RoundStatusBadge';
import { SlideUp } from '../components/AnimatedComponents';
import { getQuizService } from '../services/quizService';
import { Round, PlayerWithStats, MainTab } from '../types';
import { COLORS } from '../constants/colors';
import { APP_CONFIG } from '../constants/config';
import { formatDateDisplay, pluralize } from '../utils/formatters';
import { logError } from '../utils/logger';

interface HomeScreenProps {
  onNavigate: (tab: MainTab) => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onOpenSettings }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingRound, setWorkingRound] = useState<Round | null>(null);
  const [counts, setCounts] = useState<{
    totalPlayers: number;
    assignedCount: number;
    unassignedCount: number;
  }>({ totalPlayers: 0, assignedCount: 0, unassignedCount: 0 });
  const [leader, setLeader] = useState<PlayerWithStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      const service = await getQuizService();
      const current = await service.rounds.getCurrentWorkingRound();
      setWorkingRound(current);

      if (current) {
        const roundCounts = await service.groups.getCountsForRound(current.id);
        setCounts(roundCounts);
      } else {
        const allPlayers = await service.players.getAllPlayers(true);
        setCounts({
          totalPlayers: allPlayers.length,
          assignedCount: 0,
          unassignedCount: allPlayers.length,
        });
      }

      const topPlayer = await service.scores.getCurrentLeader();
      setLeader(topPlayer);
    } catch (err) {
      logError('Error loading home data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={APP_CONFIG.appName}
        subtitle="Offline Quiz Score Management"
        onSettingsPress={onOpenSettings}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* CURRENT ROUND SECTION */}
        <SlideUp delay={100}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>CURRENT ROUND</Text>
            {workingRound && <RoundStatusBadge status={workingRound.status} />}
          </View>
        </SlideUp>

        <SlideUp delay={200}>
          {workingRound ? (
            <View style={styles.card}>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <Text style={styles.dateText}>
                  {formatDateDisplay(workingRound.round_date)}
                </Text>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{counts.totalPlayers}</Text>
                  <Text style={styles.statLabel}>Total Players</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{workingRound.group_count}</Text>
                  <Text style={styles.statLabel}>Groups</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: COLORS.success }]}>
                    {counts.assignedCount}
                  </Text>
                  <Text style={styles.statLabel}>Assigned</Text>
                </View>

                <View style={styles.statBox}>
                  <Text
                    style={[
                      styles.statValue,
                      counts.unassignedCount > 0 && { color: COLORS.warning },
                    ]}
                  >
                    {counts.unassignedCount}
                  </Text>
                  <Text style={styles.statLabel}>Unassigned</Text>
                </View>
              </View>

              {/* Quick Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onNavigate('round');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryActionText}>Manage Groups</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onNavigate('round');
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryActionButton}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryActionText}>
                      {workingRound.status === 'ACTIVE' ? 'Enter Scores' : 'Round Screen'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <EmptyState
                iconName="cube-outline"
                title="No active round"
                description="Create a new round to assign players to groups and start scoring."
                actionText="Create New Round"
                onActionPress={() => onNavigate('round')}
              />
            </View>
          )}
        </SlideUp>

        {/* DIVIDER */}
        <View style={styles.divider} />

        <SlideUp delay={300}>
          {/* CURRENT LEADER SECTION */}
          <Text style={styles.sectionTitle}>CURRENT LEADER</Text>

          {leader && leader.total_score > 0 ? (
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.leaderCard}
            >
              <View style={styles.leaderTrophyCircle}>
                <Ionicons name="trophy" size={28} color={COLORS.accent} />
              </View>

              <View style={styles.leaderInfo}>
                <View style={styles.leaderNameRow}>
                  <Text style={[styles.leaderName, { color: '#FFFFFF' }]} numberOfLines={1}>
                    {leader.name}
                  </Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                      #{leader.player_number}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.leaderRounds, { color: 'rgba(255,255,255,0.8)' }]}>
                  {leader.rounds_played} {pluralize(leader.rounds_played, 'round')} played
                </Text>
              </View>

              <View style={styles.leaderScoreBox}>
                <Text style={[styles.leaderScore, { color: '#FFFFFF' }]}>{leader.total_score}</Text>
                <Text style={[styles.leaderScoreUnit, { color: 'rgba(255,255,255,0.7)' }]}>Points</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noLeaderText}>
                No scores recorded yet. Complete a round to see the leader!
              </Text>
            </View>
          )}
        </SlideUp>

        <SlideUp delay={400}>
          <TouchableOpacity
            style={styles.viewReportsButton}
            onPress={() => onNavigate('reports')}
          >
            <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
            <Text style={styles.viewReportsText}>View Full Reports & Rankings</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </SlideUp>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120, // Increased for floating tab bar
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  leaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  leaderTrophyCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accentContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaderName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  leaderRounds: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  leaderScoreBox: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  leaderScore: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  leaderScoreUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  noLeaderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  viewReportsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  viewReportsText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
