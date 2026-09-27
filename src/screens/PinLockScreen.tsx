import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';
import { getPIN, setPIN, hasPIN } from '../utils/pinStorage';
import { FadeIn, SlideUp } from '../components/AnimatedComponents';
import { DestructiveConfirmModal } from '../components/DestructiveConfirmModal';

const RESTORE_WORD = 'PinRestoration';

const KEYPAD_LETTERS: Record<string, string> = {
  '1': '',
  '2': 'A B C',
  '3': 'D E F',
  '4': 'G H I',
  '5': 'J K L',
  '6': 'M N O',
  '7': 'P Q R S',
  '8': 'T U V',
  '9': 'W X Y Z',
  '0': '+',
};

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm' | 'unlock'>('unlock');
  const [storedPin, setStoredPin] = useState<string | null>(null);

  // Offline PIN restoration state
  const [showRestorePinModal, setShowRestorePinModal] = useState(false);
  const [isPinRestoration, setIsPinRestoration] = useState(false);

  const shakeAnimation = useMemo(() => new Animated.Value(0), []);

  const checkPinStatus = useCallback(async () => {
    const hasExistingPin = await hasPIN();
    if (hasExistingPin) {
      const p = await getPIN();
      setStoredPin(p);
      setStep('unlock');
    } else {
      setStep('enter');
    }
  }, []);

  useEffect(() => {
    checkPinStatus();
  }, [checkPinStatus]);

  const shake = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const handlePinComplete = useCallback(async (currentPin: string) => {
    if (step === 'unlock') {
      if (currentPin === storedPin) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onUnlock();
      } else {
        shake();
        setPin('');
      }
    } else if (step === 'enter') {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setConfirmPin(currentPin);
      setPin('');
      setStep('confirm');
    } else if (step === 'confirm') {
      if (currentPin === confirmPin) {
        await setPIN(currentPin);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onUnlock();
      } else {
        shake();
        Alert.alert('Error', 'PINs do not match. Try again.');
        setPin('');
        setConfirmPin('');
        setStep('enter');
      }
    }
  }, [step, storedPin, confirmPin, onUnlock, shake]);

  useEffect(() => {
    if (pin.length === 4) {
      handlePinComplete(pin);
    }
  }, [pin, handlePinComplete]);

  const handleKeyPress = (num: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPin(prev => prev.slice(0, -1));
  };

  const handleForgotPin = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowRestorePinModal(true);
  };

  // Offline restoration: replaces the forgotten PIN with a new one
  const handleConfirmPinRestoration = () => {
    setShowRestorePinModal(false);
    setIsPinRestoration(true);
    setStoredPin(null);
    setPin('');
    setConfirmPin('');
    setStep('enter');
  };

  const handleCancelPinRestoration = () => {
    setShowRestorePinModal(false);
  };

  const getTitle = () => {
    if (step === 'unlock') return 'Enter Security PIN';
    if (step === 'enter') return isPinRestoration ? 'Set New Security PIN' : 'Set Your Security PIN';
    if (step === 'confirm') return 'Confirm Security PIN';
    return '';
  };

  const getSubtitle = () => {
    if (step === 'confirm') return 'Re-enter your 4-digit PIN to verify';
    if (step === 'enter' && isPinRestoration) return 'This will securely replace your previous PIN';
    if (step === 'enter') return 'Create a 4-digit code to protect your scores';
    return 'Enter your 4-digit code to access management';
  };

  const renderKey = (num: string) => {
    const letters = KEYPAD_LETTERS[num];
    return (
      <TouchableOpacity
        key={num}
        style={styles.keyButton}
        onPress={() => handleKeyPress(num)}
        activeOpacity={0.65}
      >
        <Text style={styles.keyText}>{num}</Text>
        {letters ? <Text style={styles.keyLetterText}>{letters}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FadeIn duration={500} style={styles.content}>
        <View style={styles.header}>
          <LinearGradient
            colors={[COLORS.primaryContainer, '#EEF2FF']}
            style={styles.iconCircle}
          >
            <Ionicons
              name={isPinRestoration ? 'key-outline' : 'shield-checkmark-outline'}
              size={36}
              color={COLORS.primary}
            />
          </LinearGradient>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>
        </View>

        <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnimation }] }]}>
          {[0, 1, 2, 3].map(i => {
            const isFilled = pin.length > i;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isFilled && styles.dotFilled,
                ]}
              >
                {isFilled && <View style={styles.dotInner} />}
              </View>
            );
          })}
        </Animated.View>

        <SlideUp delay={100} duration={400} style={styles.keypadContainer}>
          <View style={styles.row}>
            {['1', '2', '3'].map(renderKey)}
          </View>
          <View style={styles.row}>
            {['4', '5', '6'].map(renderKey)}
          </View>
          <View style={styles.row}>
            {['7', '8', '9'].map(renderKey)}
          </View>
          <View style={styles.row}>
            <View style={styles.keyButtonEmpty} />
            {renderKey('0')}
            <TouchableOpacity style={styles.keyButton} onPress={handleBackspace} activeOpacity={0.65}>
              <Ionicons name="backspace-outline" size={26} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </SlideUp>

        {step === 'unlock' && (
          <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPin} activeOpacity={0.7}>
            <Ionicons name="key-outline" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </TouchableOpacity>
        )}
      </FadeIn>

      {/* OFFLINE PIN RESTORATION */}
      <DestructiveConfirmModal
        visible={showRestorePinModal}
        iconName="key-outline"
        title="Forgot PIN?"
        message="This app works fully offline, so there is no account to verify against. Type the restore word to replace your forgotten PIN with a new one. Anyone with access to this device can do this."
        confirmWord={RESTORE_WORD}
        onConfirm={handleConfirmPinRestoration}
        onCancel={handleCancelPinRestoration}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 44,
    height: 30,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(79, 70, 229, 0.4)',
    marginHorizontal: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  keyButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyButtonEmpty: {
    width: 74,
    height: 74,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  keyLetterText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: -2,
  },
  forgotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
  },
  forgotText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
