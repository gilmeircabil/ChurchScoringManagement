import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { getPIN, setPIN, hasPIN } from '../utils/pinStorage';
import { FadeIn, SlideUp } from '../components/AnimatedComponents';
import { DestructiveConfirmModal } from '../components/DestructiveConfirmModal';

const RESTORE_WORD = 'PinRestoration';

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
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const handlePinComplete = useCallback(async (currentPin: string) => {
    if (step === 'unlock') {
      if (currentPin === storedPin) {
        onUnlock();
      } else {
        shake();
        setPin('');
      }
    } else if (step === 'enter') {
      setConfirmPin(currentPin);
      setPin('');
      setStep('confirm');
    } else if (step === 'confirm') {
      if (currentPin === confirmPin) {
        await setPIN(currentPin);
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
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleForgotPin = () => {
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
    if (step === 'unlock') return 'Enter PIN to Continue';
    if (step === 'enter') return isPinRestoration ? 'Set a New PIN' : 'Set Your PIN';
    if (step === 'confirm') return 'Confirm Your PIN';
    return '';
  };

  const getSubtitle = () => {
    if (step === 'confirm') return 'Please enter your PIN again';
    if (step === 'enter' && isPinRestoration) return 'This will replace your forgotten PIN';
    return undefined;
  };

  const renderKey = (num: string) => {
    return (
      <TouchableOpacity
        key={num}
        style={styles.keyButton}
        onPress={() => handleKeyPress(num)}
        activeOpacity={0.6}
      >
        <Text style={styles.keyText}>{num}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FadeIn duration={600} style={styles.content}>
        <View style={styles.header}>
          <Ionicons
            name={isPinRestoration ? 'key-outline' : 'lock-closed'}
            size={48}
            color={COLORS.primary}
            style={styles.icon}
          />
          <Text style={styles.title}>{getTitle()}</Text>
          {getSubtitle() && <Text style={styles.subtitle}>{getSubtitle()}</Text>}
        </View>

        <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnimation }] }]}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                pin.length > i && styles.dotFilled,
              ]}
            />
          ))}
        </Animated.View>

        <SlideUp delay={200} duration={500} style={styles.keypadContainer}>
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
            <TouchableOpacity style={styles.keyButton} onPress={handleBackspace} activeOpacity={0.6}>
              <Ionicons name="backspace-outline" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </SlideUp>

        {step === 'unlock' && (
          <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPin}>
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
    marginBottom: 48,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 64,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginHorizontal: 12,
    backgroundColor: 'transparent',
  },
  dotFilled: {
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
    marginBottom: 24,
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  keyButtonEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: 32,
    fontWeight: '400',
    color: COLORS.textPrimary,
  },
  forgotButton: {
    marginTop: 32,
    padding: 12,
  },
  forgotText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
