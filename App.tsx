import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getDatabaseConnection } from './src/database/database';
import { getQuizService } from './src/services/quizService';
import { TabBar } from './src/components/TabBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { PlayersScreen } from './src/screens/PlayersScreen';
import { RoundScreen } from './src/screens/RoundScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MainTab } from './src/types';
import { COLORS } from './src/constants/colors';
import { APP_CONFIG } from './src/constants/config';

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasActiveRound, setHasActiveRound] = useState(false);
  const [targetRoundId, setTargetRoundId] = useState<string | undefined>(undefined);

  const initApp = useCallback(async () => {
    try {
      await getDatabaseConnection();
      const service = await getQuizService();
      const current = await service.rounds.getCurrentWorkingRound();
      setHasActiveRound(Boolean(current && current.status === 'ACTIVE'));
      setIsDbReady(true);
    } catch (err: any) {
      console.error('App init failed:', err);
      setDbError(err.message || 'Failed to initialize local SQLite database.');
    }
  }, []);

  useEffect(() => {
    initApp();
  }, [initApp]);

  const refreshActiveRoundStatus = async () => {
    try {
      const service = await getQuizService();
      const current = await service.rounds.getCurrentWorkingRound();
      setHasActiveRound(Boolean(current && current.status === 'ACTIVE'));
    } catch {
      // Ignore
    }
  };

  const handleTabChange = (tab: MainTab) => {
    setIsSettingsOpen(false);
    setActiveTab(tab);
    refreshActiveRoundStatus();
  };

  const handleOpenRoundWithId = (roundId: string) => {
    setTargetRoundId(roundId);
    setActiveTab('round');
    setIsSettingsOpen(false);
  };

  if (!isDbReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.outerContainer}>
          <SafeAreaView style={[styles.safeArea, styles.splashContainer]}>
            <StatusBar style="dark" />
            {dbError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Database Initialization Failed</Text>
                <Text style={styles.errorMessage}>{dbError}</Text>
              </View>
            ) : (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.appNameText}>{APP_CONFIG.appName}</Text>
                <Text style={styles.appSubText}>Loading local database...</Text>
              </View>
            )}
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.outerContainer}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar style="dark" />

          <View style={styles.mainContent}>
            {isSettingsOpen ? (
              <SettingsScreen onBack={() => setIsSettingsOpen(false)} />
            ) : (
              <>
                {activeTab === 'home' && (
                  <HomeScreen
                    onNavigate={handleTabChange}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                )}
                {activeTab === 'players' && (
                  <PlayersScreen
                    onNavigate={handleTabChange}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                )}
                {activeTab === 'round' && (
                  <RoundScreen
                    onNavigate={handleTabChange}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    targetRoundId={targetRoundId}
                  />
                )}
                {activeTab === 'reports' && (
                  <ReportsScreen
                    onNavigate={handleTabChange}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                )}
                {activeTab === 'history' && (
                  <HistoryScreen
                    onNavigate={handleTabChange}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onSelectRoundForScreen={handleOpenRoundWithId}
                  />
                )}
              </>
            )}
          </View>

          {!isSettingsOpen && (
            <TabBar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              hasActiveRound={hasActiveRound}
            />
          )}
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#0F172A' : COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    backgroundColor: COLORS.surface,
    ...(Platform.OS === 'web'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
        }
      : {}),
  },
  mainContent: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  loadingBox: {
    alignItems: 'center',
  },
  appNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 16,
    letterSpacing: -0.3,
  },
  appSubText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  errorBox: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: COLORS.dangerContainer,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
});
