import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform, useWindowDimensions } from 'react-native';
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
import { WheelScreen } from './src/screens/WheelScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AppIntroScreen } from './src/components/AppIntroScreen';
import { MainTab } from './src/types';
import { COLORS } from './src/constants/colors';
import { APP_CONFIG } from './src/constants/config';
import { logError } from './src/utils/logger';
import { getErrorMessage } from './src/utils/errors';

// Remove harsh browser default focus outline rings on web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'suppress-browser-focus-outline';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      input, textarea, select, [contenteditable] {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        outline-color: transparent !important;
        box-shadow: none !important;
      }
      input:focus, textarea:focus, select:focus, [contenteditable]:focus {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        outline-color: transparent !important;
        box-shadow: none !important;
      }
      *:focus-visible {
        outline: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

export default function App() {
  const { width } = useWindowDimensions();
  const isTabletOrWide = width >= 768 || Platform.OS === 'web';

  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
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
      logError('App init failed:', err);
      setDbError(getErrorMessage(err, 'Failed to initialize local SQLite database.', 'App'));
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

  // 1. Show smooth animated logo intro before homepage
  if (showIntro) {
    return (
      <SafeAreaProvider>
        <View style={styles.outerContainer}>
          <AppIntroScreen
            onFinish={() => {
              setShowIntro(false);
            }}
            isReady={isDbReady}
          />
        </View>
      </SafeAreaProvider>
    );
  }

  // 2. Database loading fallback (if intro was dismissed before DB finished)
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
      <View style={[styles.outerContainer, isTabletOrWide && styles.outerContainerTablet]}>
        <SafeAreaView
          style={[styles.safeArea, isTabletOrWide && styles.safeAreaTablet]}
          edges={['top', 'left', 'right']}
        >
          <StatusBar style="dark" />

          <View style={styles.mainContent}>
            {isSettingsOpen ? (
              <SettingsScreen
                onBack={() => setIsSettingsOpen(false)}
                onReplayIntro={() => setShowIntro(true)}
              />
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
                {activeTab === 'wheel' && (
                  <WheelScreen
                    onNavigate={handleTabChange}
                    onOpenSettings={() => setIsSettingsOpen(true)}
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
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerContainerTablet: {
    backgroundColor: '#0F172A',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.surface,
  },
  safeAreaTablet: {
    maxWidth: 720,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
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
