import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';
import { ExcelParseResult, downloadExcelTemplate } from '../utils/excelImport';
import { pluralize } from '../utils/formatters';
import { logError } from '../utils/logger';

interface ExcelImportModalProps {
  visible: boolean;
  parseResult: ExcelParseResult | null;
  onConfirmImport: () => Promise<void>;
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  visible,
  parseResult,
  onConfirmImport,
  onClose,
}) => {
  const [importing, setImporting] = useState(false);
  const [showStructureHelp, setShowStructureHelp] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  if (!parseResult) return null;

  const validCount = parseResult.validRows.length;
  const invalidCount = parseResult.invalidRows.length;
  const duplicateCount = parseResult.duplicateCount;

  const handleImport = async () => {
    if (validCount === 0 || importing) return;
    setImporting(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await onConfirmImport();
      onClose();
    } catch (err) {
      logError('Failed to import players:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await downloadExcelTemplate();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      logError('Download template failed:', err);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="document-text" size={22} color="#107C41" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  Import Players from Excel
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  File: {parseResult.fileName}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} disabled={importing}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Quick Helper Bar */}
          <View style={styles.helperBar}>
            <TouchableOpacity
              style={styles.templateBtn}
              onPress={handleDownloadTemplate}
              disabled={downloadingTemplate}
            >
              <Ionicons name="download-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.templateBtnText}>
                {downloadingTemplate ? 'Downloading...' : 'Get Excel Template'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.structureToggleBtn}
              onPress={() => setShowStructureHelp(!showStructureHelp)}
            >
              <Ionicons name="information-circle-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.structureToggleText}>
                {showStructureHelp ? 'Hide Format' : 'View Format'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline Format Explanation if expanded */}
          {showStructureHelp && (
            <View style={styles.structureHelpBox}>
              <Text style={styles.structureTitle}>Expected Excel Structure:</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: '700' }]}>Column 1: Name</Text>
                <Text style={[styles.tableCell, { flex: 1.5, fontWeight: '700' }]}>Column 2: Initial Score</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>John Doe</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>25 (or blank = 0)</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Sarah Smith</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>10</Text>
              </View>
              <Text style={styles.structureFootnote}>
                • Columns are case-insensitive (`Name`, `Initial Score`, `Score`, `Points`).
              </Text>
            </View>
          )}

          {/* Summary Badges Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, { backgroundColor: COLORS.successContainer }]}>
              <Ionicons name="checkmark-circle" size={15} color={COLORS.success} />
              <Text style={[styles.statBadgeText, { color: COLORS.onSuccessContainer }]}>
                {validCount} {pluralize(validCount, 'player')} ready
              </Text>
            </View>

            {duplicateCount > 0 && (
              <View style={[styles.statBadge, { backgroundColor: COLORS.warningContainer }]}>
                <Ionicons name="alert-circle" size={15} color={COLORS.warning} />
                <Text style={[styles.statBadgeText, { color: COLORS.onWarningContainer }]}>
                  {duplicateCount} duplicate {duplicateCount === 1 ? 'name' : 'names'}
                </Text>
              </View>
            )}

            {invalidCount > 0 && (
              <View style={[styles.statBadge, { backgroundColor: COLORS.dangerContainer }]}>
                <Ionicons name="close-circle" size={15} color={COLORS.danger} />
                <Text style={[styles.statBadgeText, { color: COLORS.onDangerContainer }]}>
                  {invalidCount} invalid {invalidCount === 1 ? 'row' : 'rows'}
                </Text>
              </View>
            )}
          </View>

          {/* Scrollable Preview List */}
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {/* Valid Players Section */}
            {validCount > 0 && (
              <View style={styles.listSection}>
                <Text style={styles.sectionTitle}>VALID PLAYERS PREVIEW</Text>
                {parseResult.validRows.map((player, idx) => (
                  <View key={`valid-${idx}`} style={styles.previewRow}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.rowNumber}>#{idx + 1}</Text>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {player.name}
                      </Text>
                      {player.isDuplicateInFile && (
                        <View style={styles.dupBadge}>
                          <Text style={styles.dupBadgeText}>Duplicate</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreBadgeText}>
                        {player.initialScore > 0 ? `+${player.initialScore} pts` : '0 pts'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Invalid Rows Section if any */}
            {invalidCount > 0 && (
              <View style={[styles.listSection, { marginTop: 12 }]}>
                <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>
                  SKIPPED / INVALID ROWS ({invalidCount})
                </Text>
                {parseResult.invalidRows.map((inv, idx) => (
                  <View key={`inv-${idx}`} style={styles.invalidRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invalidRowTitle}>
                        Row {inv.rowNumber}: {inv.name}
                      </Text>
                      <Text style={styles.invalidRowReason}>{inv.error}</Text>
                    </View>
                    <Ionicons name="warning-outline" size={18} color={COLORS.danger} />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Duplicate Rule Note */}
          {duplicateCount > 0 && (
            <Text style={styles.duplicateFootnote}>
              💡 Duplicate names are allowed and will each be assigned a unique sequence ID (e.g. #001, #002) for distinct tracking.
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={importing}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importBtn, validCount === 0 && styles.importBtnDisabled]}
              onPress={handleImport}
              disabled={validCount === 0 || importing}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  validCount > 0
                    ? [COLORS.primary, COLORS.primaryLight]
                    : [COLORS.borderDark, COLORS.border]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.importBtnGradient}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="cloud-upload" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.importBtnText}>
                  {importing ? 'Importing...' : `Import ${validCount} ${pluralize(validCount, 'Player')}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceVariant,
  },
  helperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  structureToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  structureToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  structureHelpBox: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  structureTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableCell: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  structureFootnote: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollList: {
    maxHeight: 280,
    marginBottom: 10,
  },
  listSection: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rowNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    width: 26,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  dupBadge: {
    backgroundColor: COLORS.warningContainer,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  dupBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onWarningContainer,
  },
  scoreBadge: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  invalidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  invalidRowTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  invalidRowReason: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 1,
  },
  duplicateFootnote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  importBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  importBtnDisabled: {
    opacity: 0.6,
  },
  importBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
