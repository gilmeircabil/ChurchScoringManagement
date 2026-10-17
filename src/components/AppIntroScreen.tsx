import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '../utils/haptics';

interface AppIntroScreenProps {
  onFinish: () => void;
  isReady?: boolean;
}

const TIGER_BODY = require('../../assets/tiger-body.png');
const TIGER_PAW = require('../../assets/tiger-paw.png');

export const AppIntroScreen: React.FC<AppIntroScreenProps> = ({
  onFinish,
  isReady = true,
}) => {
  // Entrance animation values
  const mascotScale = useMemo(() => new Animated.Value(0.5), []);
  const mascotOpacity = useMemo(() => new Animated.Value(0), []);
  const mascotTranslateY = useMemo(() => new Animated.Value(35), []);

  const haloScale = useMemo(() => new Animated.Value(0.65), []);
  const haloOpacity = useMemo(() => new Animated.Value(0), []);

  const bubbleScale = useMemo(() => new Animated.Value(0), []);
  const bubbleOpacity = useMemo(() => new Animated.Value(0), []);

  const titleOpacity = useMemo(() => new Animated.Value(0), []);
  const titleTranslateY = useMemo(() => new Animated.Value(18), []);

  // Hand waving animation (specifically moving the paw back and forth)
  const handWaveAnim = useMemo(() => new Animated.Value(0), []);

  // Gentle breathing float for the body (up and down only, body does NOT rotate)
  const floatAnim = useMemo(() => new Animated.Value(0), []);

  // Master exit animation
  const exitOpacity = useMemo(() => new Animated.Value(1), []);
  const exitScale = useMemo(() => new Animated.Value(1), []);
  const hasFinishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const isReadyRef = useRef(isReady);
  const isAnimationDoneRef = useRef(false);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const handleCompleteTransition = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Animated.parallel([
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitScale, {
        toValue: 1.06,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinishRef.current();
    });
  }, [exitOpacity, exitScale]);

  useEffect(() => {
    isReadyRef.current = isReady;
    if (isReady && isAnimationDoneRef.current && !hasFinishedRef.current) {
      handleCompleteTransition();
    }
  }, [isReady, handleCompleteTransition]);

  useEffect(() => {
    // 1. Entrance sequence
    Animated.sequence([
      // Tiger body & glowing halo entrance
      Animated.parallel([
        Animated.spring(mascotScale, {
          toValue: 1,
          tension: 50,
          friction: 6.5,
          useNativeDriver: true,
        }),
        Animated.timing(mascotTranslateY, {
          toValue: 0,
          duration: 480,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(mascotOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(haloScale, {
          toValue: 1.25,
          duration: 750,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(haloOpacity, {
          toValue: 0.6,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Speech bubble ("Hi! Welcome! 👋") pops out right by the waving hand
      Animated.parallel([
        Animated.spring(bubbleScale, {
          toValue: 1,
          tension: 65,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Continuous rhythmic hand waving animation (back and forth 👋)
      Animated.loop(
        Animated.sequence([
          Animated.timing(handWaveAnim, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(handWaveAnim, {
            toValue: -1,
            duration: 420,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(handWaveAnim, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(handWaveAnim, {
            toValue: -1,
            duration: 420,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(handWaveAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.delay(400), // Brief friendly pause between wave sets
        ])
      ).start();

      // Gentle vertical breathing float (body stays stable and upright, only floats up and down)
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -8,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Duration: 3.8s allows multiple full hand waving cycles
    const durationTimer = setTimeout(() => {
      isAnimationDoneRef.current = true;
      if (isReadyRef.current && !hasFinishedRef.current) {
        handleCompleteTransition();
      }
    }, 3800);

    // Safety fallback
    const fallbackTimer = setTimeout(() => {
      if (!hasFinishedRef.current) {
        handleCompleteTransition();
      }
    }, 5500);

    return () => {
      clearTimeout(durationTimer);
      clearTimeout(fallbackTimer);
    };
  }, [
    bubbleOpacity,
    bubbleScale,
    floatAnim,
    haloOpacity,
    haloScale,
    handWaveAnim,
    handleCompleteTransition,
    mascotOpacity,
    mascotScale,
    mascotTranslateY,
    titleOpacity,
    titleTranslateY,
  ]);

  // Interpolate hand rotation for waving: -16deg to +16deg around the wrist
  const interpolatedHandRotation = handWaveAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-16deg', '0deg', '16deg'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.98}
      style={styles.touchableWrapper}
      onPress={handleCompleteTransition}
      accessibilityLabel="Tap to continue"
    >
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.container,
          {
            opacity: exitOpacity,
            transform: [{ scale: exitScale }],
          },
        ]}
      >
        {/* Deep rich midnight background */}
        <LinearGradient
          colors={['#040711', '#090F24', '#121838', '#1C1947']}
          locations={[0, 0.35, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Ambient glowing halo behind mascot */}
        <Animated.View
          style={[
            styles.haloContainer,
            {
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(245, 158, 11, 0.32)', 'rgba(99, 102, 241, 0.25)', 'transparent']}
            style={styles.haloGlow}
          />
        </Animated.View>

        {/* Center content */}
        <View style={styles.centerContent}>
          {/* Mascot Container: Stable upright body with gentle breathing float */}
          <Animated.View
            style={[
              styles.mascotWrapper,
              {
                opacity: mascotOpacity,
                transform: [
                  { scale: mascotScale },
                  { translateY: Animated.add(mascotTranslateY, floatAnim) },
                ],
              },
            ]}
          >
            {/* Outer luxury gold & amber rim ring */}
            <View style={styles.mascotOuterRim}>
              {/* Inner mascot frame holding the tiger body and waving paw */}
              <View style={styles.mascotFrame}>
                {/* 1. Tiger Body (steady, dapper in suit) */}
                <Image
                  source={TIGER_BODY}
                  style={styles.tigerImage}
                  resizeMode="cover"
                />

                {/* 2. Isolated Tiger Paw waving right on top of his sleeve cuff */}
                <Animated.View
                  style={[
                    styles.pawContainer,
                    {
                      transform: [
                        { rotate: interpolatedHandRotation },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={TIGER_PAW}
                    style={styles.pawImage}
                    resizeMode="contain"
                  />
                </Animated.View>

                {/* Soft bottom blend gradient */}
                <LinearGradient
                  colors={['transparent', 'rgba(4, 7, 17, 0.2)', 'rgba(4, 7, 17, 0.6)']}
                  style={styles.imageOverlayGradient}
                />
              </View>
            </View>

            {/* Aesthetic Speech Bubble: "Hi! Welcome! 👋" */}
            <Animated.View
              style={[
                styles.speechBubble,
                {
                  opacity: bubbleOpacity,
                  transform: [{ scale: bubbleScale }],
                },
              ]}
            >
              <Text style={styles.speechBubbleEmoji}>👋</Text>
              <Text style={styles.speechBubbleText}>Hi! Welcome!</Text>
              <View style={styles.speechBubbleTail} />
            </Animated.View>
          </Animated.View>

          {/* App Title */}
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            <Text style={styles.titlePrimary}>
              Quiz Score <Text style={styles.titleAccent}>Manager</Text>
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchableWrapper: {
    flex: 1,
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#040711',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  haloContainer: {
    position: 'absolute',
    width: 380,
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloGlow: {
    width: '100%',
    height: '100%',
    borderRadius: 190,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
  },
  mascotWrapper: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mascotOuterRim: {
    width: 230,
    height: 260,
    borderRadius: 52,
    padding: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.65)', // Elegant gold rim
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 18,
  },
  mascotFrame: {
    flex: 1,
    borderRadius: 48,
    backgroundColor: '#070C1E',
    overflow: 'hidden',
    position: 'relative',
  },
  tigerImage: {
    width: '100%',
    height: '100%',
  },
  pawContainer: {
    position: 'absolute',
    left: '17.1%',
    top: '21.0%',
    width: '16.1%',
    height: '16.6%',
    transformOrigin: '50% 95%', // Pivot right at the wrist cuff!
  },
  pawImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlayGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
  },
  speechBubble: {
    position: 'absolute',
    top: -12,
    left: -16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.75)',
  },
  speechBubbleEmoji: {
    fontSize: 15,
    marginRight: 5,
  },
  speechBubbleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  speechBubbleTail: {
    position: 'absolute',
    bottom: -6,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 6,
  },
  titlePrimary: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  titleAccent: {
    color: '#FBBF24', // Warm gold
    fontWeight: '900',
  },
});
