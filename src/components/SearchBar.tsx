import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  matchCount?: number;
  showMatchCount?: boolean;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rightAction?: React.ReactNode;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  matchCount,
  showMatchCount = false,
  autoFocus = false,
  autoCapitalize = 'words',
  style,
  inputStyle,
  rightAction,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onClear) {
      onClear();
    } else {
      onChangeText('');
    }
  };

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        style,
      ]}
    >
      {/* Search Icon */}
      <Ionicons
        name="search-outline"
        size={18}
        color={isFocused ? COLORS.primary : COLORS.textMuted}
        style={styles.searchIcon}
      />

      {/* Text Input */}
      <TextInput
        style={[
          styles.input,
          Platform.OS === 'web' &&
            ({
              outline: 'none',
              outlineStyle: 'none',
              outlineWidth: 0,
              outlineColor: 'transparent',
            } as any),
          inputStyle,
        ]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        numberOfLines={1}
        multiline={false}
      />

      {/* Match count badge */}
      {showMatchCount && matchCount !== undefined && value.trim().length > 0 && (
        <View style={styles.matchBadge}>
          <Text style={styles.matchBadgeText}>
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </Text>
        </View>
      )}

      {/* Clear Button */}
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Clear search text"
        >
          <Ionicons name="close" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Optional Right Action Slot */}
      {rightAction}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    minHeight: 46,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    ...(Platform.OS === 'web'
      ? ({
          outline: 'none',
          outlineStyle: 'none',
          outlineWidth: 0,
        } as any)
      : {}),
  },
  containerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          outline: 'none',
          outlineStyle: 'none',
          outlineWidth: 0,
        } as any)
      : {}),
  },
  searchIcon: {
    marginRight: 8,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    padding: 0,
    margin: 0,
    ...(Platform.OS === 'web'
      ? ({
          outline: 'none',
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          boxShadow: 'none',
        } as any)
      : {}),
  },
  matchBadge: {
    flexShrink: 0,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 6,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onPrimaryContainer,
  },
  clearButton: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
