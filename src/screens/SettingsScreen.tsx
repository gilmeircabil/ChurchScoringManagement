import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Header } from '../components/Header';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { DestructiveConfirmModal } from '../components/DestructiveConfirmModal';
import { StatusBanner, StatusMessage } from '../components/StatusBanner';
import { getQuizService } from '../services/quizService';
import { COLORS } from '../constants/colors';
import { APP_CONFIG } from '../constants/config';
import { BackupData } from '../types';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);

  // Raw JSON modal state
  const [isRawJsonModalVisible, setIsRawJsonModalVisible] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [rawJsonMode, setRawJsonMode] = useState<'export' | 'import'>('export');

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
        text: err.message || 'Failed to delete all data.',
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
      console.error('Export error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to export backup.',
      });
    } finally {
      setLoading(false);
    }
  };

  // View raw JSON for copying
  const handleViewRawJson = async () => {
    setLoading(true);
    try {
      const service = await getQuizService();
      const data = await service.backup.generateBackupData();
      setRawJsonText(JSON.stringify(data, null, 2));
      setRawJsonMode('export');
      setIsRawJsonModalVisible(true);
    } catch (_err: any) {
      Alert.alert('Error', 'Unable to generate JSON preview.');
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
      console.error('File pick error:', err);
      setStatusMessage({
        type: 'error',
        text: 'Failed to read selected file: ' + (err.message || 'Unknown error'),
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
      Alert.alert('Invalid JSON', 'The selected file or text is not valid JSON.');
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
      setIsRawJsonModalVisible(false);
      setRawJsonText('');
      setStatusMessage({
        type: 'success',
        text: `Restore complete! Successfully imported ${pendingBackupData.players.length} players, ${pendingBackupData.rounds.length} rounds, and ${pendingBackupData.scores.length} scores.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Restore failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Settings & Backup"
        subtitle="Offline Data Management"
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
          <Text style={styles.cardDescription}>
            Save a full backup of all players, rounds, manual group assignments, and score records to your device storage or share it.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleExportBackup}
              disabled={loading}
            >
              <Ionicons name="share-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Export Backup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleViewRawJson}
              disabled={loading}
            >
              <Ionicons name="code-slash-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>View JSON</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.cardTitle}>Import Backup</Text>
          <Text style={styles.cardDescription}>
            Restore your quiz data from a previously exported JSON backup file. All data will be validated before replacing current records.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePickBackupFile}
              disabled={loading}
            >
              <Ionicons name="folder-open-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>Choose File</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setRawJsonText('');
                setRawJsonMode('import');
                setIsRawJsonModalVisible(true);
              }}
              disabled={loading}
            >
              <Ionicons name="clipboard-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>Paste JSON</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* APP INFO SECTION */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>APPLICATION INFO</Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Application Name</Text>
            <Text style={styles.infoValue}>{APP_CONFIG.appName}</Text>
          </View>
          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{APP_CONFIG.version}</Text>
          </View>
          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Developer</Text>
            <Text style={[styles.infoValue, { color: COLORS.primary }]}>
              {APP_CONFIG.developer}
            </Text>
          </View>
        </View>

        {/* DANGER ZONE SECTION */}
        <Text style={[styles.sectionHeader, { marginTop: 24, color: COLORS.danger }]}>DANGER ZONE</Text>

        <View style={[styles.card, { borderColor: COLORS.dangerContainer }]}>
          <Text style={[styles.cardTitle, { color: COLORS.danger }]}>Delete All Data</Text>
          <Text style={styles.cardDescription}>
            Permanently erase all players, rounds, groups, and score records. This action cannot be undone.
          </Text>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => setShowDeleteAllModal(true)}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
            <Text style={styles.dangerButtonText}>Delete All Data</Text>
          </TouchableOpacity>
        </View>

        {/* DEVELOPER CREDIT */}
        <View style={styles.creditBlock}>
          <Ionicons name="code-slash" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.creditText}>
            {APP_CONFIG.appName} v{APP_CONFIG.version} — developed by {APP_CONFIG.developer}
          </Text>
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

      {/* RAW JSON VIEWER / PASTER MODAL */}
      <Modal
        visible={isRawJsonModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRawJsonModalVisible(false)}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.modalOverlay}>
          <View style={styles.jsonModalCard}>
            <View style={styles.jsonModalHeader}>
              <Text style={styles.jsonModalTitle}>
                {rawJsonMode === 'export' ? 'Backup JSON' : 'Paste Backup JSON'}
              </Text>
              <TouchableOpacity onPress={() => setIsRawJsonModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.jsonInput}
              multiline
              value={rawJsonText}
              onChangeText={setRawJsonText}
              placeholder={
                rawJsonMode === 'import'
                  ? 'Paste full version 1 backup JSON content here...'
                  : ''
              }
              placeholderTextColor={COLORS.textMuted}
              editable={rawJsonMode === 'import'}
              selectTextOnFocus={rawJsonMode === 'export'}
            />

            <View style={styles.jsonModalButtons}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setIsRawJsonModalVisible(false)}
              >
                <Text style={styles.cancelModalButtonText}>Close</Text>
              </TouchableOpacity>

              {rawJsonMode === 'import' && (
                <TouchableOpacity
                  style={styles.confirmModalButton}
                  onPress={() => prepareImport(rawJsonText)}
                  disabled={!rawJsonText.trim()}
                >
                  <Text style={styles.confirmModalButtonText}>Validate & Import</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

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
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
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
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
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
  creditBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  creditText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  jsonModalCard: {
    width: '100%',
    maxWidth: 440,
    height: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  jsonModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  jsonModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  jsonInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    padding: 12,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  jsonModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },
  cancelModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceVariant,
  },
  cancelModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmModalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmModalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
