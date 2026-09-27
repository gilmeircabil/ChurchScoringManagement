import React from 'react';
import { BlurView } from 'expo-blur';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Player } from '../types';
import { COLORS } from '../constants/colors';
import { pluralize } from '../utils/formatters';
import { PlayerIdBadge } from './PlayerIdBadge';
import { SearchBar } from './SearchBar';

interface UnassignedListModalProps {
  visible: boolean;
  unassignedPlayers: Player[];
  onSelectPlayer: (player: Player) => void;
  onClose: () => void;
}

export const UnassignedListModal: React.FC<UnassignedListModalProps> = ({
  visible,
  unassignedPlayers,
  onSelectPlayer,
  onClose,
}) => {
  const [filterText, setFilterText] = React.useState('');

  const filtered = unassignedPlayers.filter((p) =>
    p.name.toLowerCase().includes(filterText.trim().toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Unassigned Players</Text>
              <Text style={styles.subtitle}>
                {unassignedPlayers.length} {pluralize(unassignedPlayers.length, 'player')} waiting for group assignment
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search bar inside unassigned list */}
          <SearchBar
            value={filterText}
            onChangeText={setFilterText}
            placeholder="Filter unassigned players..."
            matchCount={filtered.length}
            showMatchCount={filterText.trim().length > 0}
            style={{ marginBottom: 12 }}
          />

          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.success} />
              <Text style={styles.emptyText}>
                {unassignedPlayers.length === 0
                  ? 'All players have been assigned!'
                  : 'No unassigned players match your search.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.playerCard}
                  onPress={() => {
                    onSelectPlayer(item);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <PlayerIdBadge playerNumber={item.player_number} />
                  </View>
                  <View style={styles.assignPill}>
                    <Text style={styles.assignPillText}>Assign</Text>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.primary} style={{ marginLeft: 4 }} />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '88%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: COLORS.borderDark,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceVariant,
  },
  listContent: {
    paddingBottom: 16,
    gap: 8,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 8,
    flexShrink: 1,
  },
  assignPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  assignPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: COLORS.surfaceVariant,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
