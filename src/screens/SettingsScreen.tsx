import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Header } from '../components/Header';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { DestructiveConfirmModal } from '../components/DestructiveConfirmModal';
import { StatusBanner, StatusMessage } from '../components/StatusBanner';
import { getQuizService } from '../services/quizService';
import { COLORS } from '../constants/colors';
import { APP_IDENTITY } from '../constants/appIdentity';
import { BackupData } from '../types';
import { formatAppVersion } from '../utils/appVersion';
import { getDefaultItemRules, saveDefaultItemRules } from '../utils/itemPointsStorage';
import { exportDatabaseBackupToExcel } from '../utils/excelExport';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/errors';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);

  /**
   * Opens an external web link. Only http(s) is allowed, so a bad constant can
   * never be turned into an arbitrary deep link.
   */
  const handleOpenLink = async (url: string, label: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Refusing to open a non-web URL for the ${label}.`);
      }
      await Linking.openURL(parsed.toString());
    } catch (error) {
      logError('SettingsScreen.openLink', error);
      Alert.alert(
        'Unable to Open Link',
        `Could not open the ${label}. Check your internet connection and try again.`
      );
    }
  };

  // Default Item Rules state (Names & Points)
  const [defaultBookName, setDefaultBookName] = useState('Book');
  const [defaultBookPts, setDefaultBookPts] = useState('10');
  const [defaultPenName, setDefaultPenName] = useState('Pen');
  const [defaultPenPts, setDefaultPenPts] = useState('5');
  const [defaultPaperName, setDefaultPaperName] = useState('Paper');
  const [defaultPaperPts, setDefaultPaperPts] = useState('5');
  const [defaultBibleName, setDefaultBibleName] = useState('Bible');
  const [defaultBiblePts, setDefaultBiblePts] = useState('5');

  React.useEffect(() => {
    getDefaultItemRules().then((rules) => {
      setDefaultBookName(rules.book_name || 'Book');
      setDefaultBookPts(String(rules.book_points));
      setDefaultPenName(rules.pen_name || 'Pen');
      setDefaultPenPts(String(rules.pen_points));
      setDefaultPaperName(rules.paper_name || 'Paper');
      setDefaultPaperPts(String(rules.paper_points));
      setDefaultBibleName(rules.bible_name || 'Bible');
      setDefaultBiblePts(String(rules.bible_points ?? 5));
    });
  }, []);

  const handleSaveItemRules = async () => {
    const bName = defaultBookName.trim() || 'Book';
    const bPts = Math.max(0, parseInt(defaultBookPts, 10) || 0);
    const pName = defaultPenName.trim() || 'Pen';
    const pPts = Math.max(0, parseInt(defaultPenPts, 10) || 0);
    const paName = defaultPaperName.trim() || 'Paper';
    const paPts = Math.max(0, parseInt(defaultPaperPts, 10) || 0);
    const biName = defaultBibleName.trim() || 'Bible';
    const biPts = Math.max(0, parseInt(defaultBiblePts, 10) || 0);

    await saveDefaultItemRules({
      book_name: bName,
      book_points: bPts,
      pen_name: pName,
      pen_points: pPts,
      paper_name: paName,
      paper_points: paPts,
      bible_name: biName,
      bible_points: biPts,
    });

    try {
      const service = await getQuizService();
      const allRounds = await service.rounds.getAllRounds();
      let updatedCount = 0;
      for (const r of allRounds) {
        if (r.status !== 'LOCKED') {
          await service.groups.updateRoundItemRules(r.id, {
            book_name: bName,
            book_points: bPts,
            pen_name: pName,
            pen_points: pPts,
            paper_name: paName,
            paper_points: paPts,
            bible_name: biName,
            bible_points: biPts,
          });
          updatedCount++;
        }
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setStatusMessage({
        type: 'success',
        text:
          updatedCount > 0
            ? `Item rules saved! Applied to ${updatedCount} active round${updatedCount > 1 ? 's' : ''}: ${bName} (${bPts} pts), ${pName} (${pPts} pts), ${paName} (${paPts} pts), ${biName} (${biPts} pts).`
            : `Item rules saved! ${bName} (${bPts} pts), ${pName} (${pPts} pts), ${paName} (${paPts} pts), ${biName} (${biPts} pts).`,
      });
    } catch (_err) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setStatusMessage({
        type: 'success',
        text: `Item rules saved! ${bName} (${bPts} pts), ${pName} (${pPts} pts), ${paName} (${paPts} pts), ${biName} (${biPts} pts).`,
      });
    }
  };

  // Confirmation modal state
  const [pendingBackupData, setPendingBackupData] = useState<BackupData | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Delete all data state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const handleDeleteAllData = async () => {
    setLoading(true);
    setShowDeleteAllModal(false);
    try {
      const service = await getQuizService();
      await service.backup.deleteAllData();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setStatusMessage({
        type: 'success',
        text: 'All data has been successfully deleted.',
      });
    } catch (err: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setStatusMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to delete all data.', 'SettingsScreen'),
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Export Backup
  const handleExportBackup = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const service = await getQuizService();
      const result = await service.backup.exportToFile();

      if (result.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setStatusMessage({
          type: 'success',
          text:
            Platform.OS === 'web'
              ? 'Backup downloaded successfully!'
              : 'Backup generated successfully! Share sheet opened.',
        });
      }
    } catch (err: any) {
      logError('Export error:', err);
      setStatusMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to export backup.', 'SettingsScreen'),
      });
    } finally {
      setLoading(false);
    }
  };

  // Export All Data to Excel (.xlsx)
  const handleExportExcelBackup = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const service = await getQuizService();
      const backupData = await service.backup.generateBackupData();
      const res = await exportDatabaseBackupToExcel(backupData);
      if (res.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setStatusMessage({
          type: 'success',
          text:
            Platform.OS === 'web'
              ? 'Excel database backup downloaded successfully!'
              : 'Excel backup generated! Share sheet opened.',
        });
      } else if (res.error) {
        setStatusMessage({
          type: 'error',
          text: res.error,
        });
      }
    } catch (err: any) {
      logError('Excel backup error:', err);
      setStatusMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to export Excel backup.', 'SettingsScreen'),
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Pick Backup File
  const handlePickBackupFile = async () => {
    setStatusMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        let content: string;
        if (Platform.OS === 'web') {
          if (file.file) {
            content = await file.file.text();
          } else {
            const res = await fetch(file.uri);
            content = await res.text();
          }
        } else {
          content = await FileSystem.readAsStringAsync(file.uri);
        }
        prepareImport(content);
      }
    } catch (err: any) {
      logError('File pick error:', err);
      setStatusMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to read the selected file.', 'SettingsScreen'),
      });
    }
  };

  // Parse and validate before showing confirmation
  const prepareImport = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      // Validate
      getQuizService().then((service) => {
        const validation = service.backup.validateBackupData(parsed);
        if (!validation.isValid) {
          Alert.alert('Invalid Backup', validation.error || 'The backup file is invalid or corrupted.');
          return;
        }

        setPendingBackupData(parsed);
        setShowRestoreConfirm(true);
      });
    } catch {
      Alert.alert('Invalid JSON', 'The selected file is not valid JSON.');
    }
  };

  // Execute restore after confirmation
  const handleConfirmRestore = async () => {
    if (!pendingBackupData) return;
    setLoading(true);
    setShowRestoreConfirm(false);
    try {
      const service = await getQuizService();
      await service.backup.restoreFromData(pendingBackupData);
      setPendingBackupData(null);
      setStatusMessage({
        type: 'success',
        text: `Restore complete! Successfully imported ${pendingBackupData.players.length} players, ${pendingBackupData.rounds.length} rounds, and ${pendingBackupData.scores.length} scores.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: getErrorMessage(err, 'Restore failed.', 'SettingsScreen'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Settings & Backup"
        showSettingsButton={false}
      />

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* BACK BUTTON */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>

        {/* STATUS BANNER */}
        <StatusBanner message={statusMessage} style={{ marginBottom: 14 }} />

        {/* BACKUP & RESTORE SECTION */}
        <Text style={styles.sectionHeader}>BACKUP & RESTORE</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Export Backup</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleExportExcelBackup}
              disabled={loading}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Export Excel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleExportBackup}
              disabled={loading}
            >
              <Ionicons name="share-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>JSON Backup</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.cardTitle}>Import Backup</Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handlePickBackupFile}
            disabled={loading}
          >
            <Ionicons name="folder-open-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryButtonText}>Choose Backup File</Text>
          </TouchableOpacity>
        </View>

        {/* APP INFO SECTION */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>APPLICATION INFO</Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{formatAppVersion()}</Text>
          </View>
          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Privacy Policy</Text>
            <TouchableOpacity
              style={styles.infoLink}
              onPress={() => handleOpenLink(APP_IDENTITY.privacyPolicyUrl, 'privacy policy')}
              accessibilityRole="link"
            >
              <Text style={styles.infoLinkText}>View policy</Text>
              <Ionicons name="open-outline" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ITEM BONUS RULES SECTION */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>ITEM BONUS RULES</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Item Rules</Text>

          <View style={styles.rulesStack}>
            {/* Item 1 */}
            <View style={styles.ruleCardSetting}>
              <Text style={styles.ruleCardLabel}>📖 Item 1 (Default: Book)</Text>
              <View style={styles.ruleInputGroup}>
                <View style={{ flex: 1.6, marginRight: 8 }}>
                  <Text style={styles.ruleMiniLabel}>Name</Text>
                  <TextInput
                    style={styles.ruleNameInput}
                    value={defaultBookName}
                    onChangeText={setDefaultBookName}
                    placeholder="Book"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleMiniLabel}>Points Each</Text>
                  <TextInput
                    style={styles.itemRuleInput}
                    value={defaultBookPts}
                    onChangeText={setDefaultBookPts}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* Item 2 */}
            <View style={styles.ruleCardSetting}>
              <Text style={styles.ruleCardLabel}>🖊️ Item 2 (Default: Pen)</Text>
              <View style={styles.ruleInputGroup}>
                <View style={{ flex: 1.6, marginRight: 8 }}>
                  <Text style={styles.ruleMiniLabel}>Name</Text>
                  <TextInput
                    style={styles.ruleNameInput}
                    value={defaultPenName}
                    onChangeText={setDefaultPenName}
                    placeholder="Pen"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleMiniLabel}>Points Each</Text>
                  <TextInput
                    style={styles.itemRuleInput}
                    value={defaultPenPts}
                    onChangeText={setDefaultPenPts}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* Item 3 */}
            <View style={styles.ruleCardSetting}>
              <Text style={styles.ruleCardLabel}>📄 Item 3 (Default: Paper)</Text>
              <View style={styles.ruleInputGroup}>
                <View style={{ flex: 1.6, marginRight: 8 }}>
                  <Text style={styles.ruleMiniLabel}>Name</Text>
                  <TextInput
                    style={styles.ruleNameInput}
                    value={defaultPaperName}
                    onChangeText={setDefaultPaperName}
                    placeholder="Paper"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleMiniLabel}>Points Each</Text>
                  <TextInput
                    style={styles.itemRuleInput}
                    value={defaultPaperPts}
                    onChangeText={setDefaultPaperPts}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* Item 4 */}
            <View style={styles.ruleCardSetting}>
              <Text style={styles.ruleCardLabel}>✝️ Item 4 (Default: Bible)</Text>
              <View style={styles.ruleInputGroup}>
                <View style={{ flex: 1.6, marginRight: 8 }}>
                  <Text style={styles.ruleMiniLabel}>Name</Text>
                  <TextInput
                    style={styles.ruleNameInput}
                    value={defaultBibleName}
                    onChangeText={setDefaultBibleName}
                    placeholder="Bible"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleMiniLabel}>Points Each</Text>
                  <TextInput
                    style={styles.itemRuleInput}
                    value={defaultBiblePts}
                    onChangeText={setDefaultBiblePts}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 14 }]}
            onPress={handleSaveItemRules}
          >
            <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryButtonText}>Save Item Rules</Text>
          </TouchableOpacity>
        </View>

        {/* DANGER ZONE SECTION */}
        <Text style={[styles.sectionHeader, { marginTop: 24, color: COLORS.danger }]}>DANGER ZONE</Text>

        <View style={[styles.card, { borderColor: COLORS.dangerContainer }]}>
          <Text style={[styles.cardTitle, { color: COLORS.danger, marginBottom: 12 }]}>Delete All Data</Text>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => setShowDeleteAllModal(true)}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
            <Text style={styles.dangerButtonText}>Delete All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* DELETE ALL DATA MODAL */}
      <DestructiveConfirmModal
        visible={showDeleteAllModal}
        title="Delete All Data?"
        message="This will permanently erase ALL players, rounds, groups, and scores. This cannot be undone."
        confirmWord="DELETE"
        onConfirm={handleDeleteAllData}
        onCancel={() => setShowDeleteAllModal(false)}
      />

      {/* RESTORE CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={showRestoreConfirm}
        title="Restore Backup?"
        message="This will replace all current players, rounds, groups, and scores with the backup file."
        subMessage={
          pendingBackupData
            ? `Backup contains: ${pendingBackupData.players.length} players, ${pendingBackupData.rounds.length} rounds, and ${pendingBackupData.scores.length} score records.`
            : undefined
        }
        confirmText="Replace & Restore"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmRestore}
        onCancel={() => {
          setShowRestoreConfirm(false);
          setPendingBackupData(null);
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  infoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '58%',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  infoLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    flexShrink: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  rulesStack: {
    gap: 10,
    marginTop: 6,
  },
  ruleCardSetting: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  ruleCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  ruleInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleMiniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  ruleNameInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemRuleInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerContainer,
    borderWidth: 1,
    borderColor: COLORS.danger,
    paddingVertical: 12,
    borderRadius: 8,
  },
  dangerButtonText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
