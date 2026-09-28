import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';

interface AppIntroScreenProps {
  onFinish: () => void;
  isReady?: boolean;
}

export const AppIntroScreen: React.FC<AppIntroScreenProps> = ({
  onFinish,
  isReady: _isReady = true,
}) => {
  const [statusText, setStatusText] = useState('Initializing system...');

  // Animation values using useMemo (best practice for React Native Animated in React 19)
  const logoScale = useMemo(() => new Animated.Value(0.3), []);
  const logoOpacity = useMemo(() => new Animated.Value(0), []);
  const haloScale = useMemo(() => new Animated.Value(0.5), []);
  const haloOpacity = useMemo(() => new Animated.Value(0), []);
  const badgeOpacity = useMemo(() => new Animated.Value(0), []);
  const badgeTranslateY = useMemo(() => new Animated.Value(14), []);
  const titleOpacity = useMemo(() => new Animated.Value(0), []);
  const titleTranslateY = useMemo(() => new Animated.Value(20), []);
  const subtitleOpacity = useMemo(() => new Animated.Value(0), []);
  const subtitleTranslateY = useMemo(() => new Animated.Value(14), []);
  const progressScaleX = useMemo(() => new Animated.Value(0), []);
  const footerOpacity = useMemo(() => new Animated.Value(0), []);
  const floatAnim = useMemo(() => new Animated.Value(0), []);

  // Master exit animation
  const exitOpacity = useMemo(() => new Animated.Value(1), []);
  const exitScale = useMemo(() => new Animated.Value(1), []);
  const hasFinishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);

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
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitScale, {
        toValue: 1.05,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinishRef.current();
    });
  }, [exitOpacity, exitScale]);

  useEffect(() => {
    // 1. Entrance animation sequence
    Animated.sequence([
      // Step A: Logo pop and halo flash
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(haloScale, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(haloOpacity, {
          toValue: 0.5,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Step B: Text elements reveal
      Animated.parallel([
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(badgeTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 350,
          delay: 100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 350,
          delay: 100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      // Start gentle floating breath loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -6,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // 2. Progress fill animation
    Animated.timing(progressScaleX, {
      toValue: 1,
      duration: 1900,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();

    // 3. Status updates & footer hint
    const t1 = setTimeout(() => {
      setStatusText('Loading offline workspace...');
    }, 600);

    const t2 = setTimeout(() => {
      setStatusText('Preparing teams & scoring...');
    }, 1200);

    const t3 = setTimeout(() => {
      setStatusText('Ready! Welcome.');
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [
    badgeOpacity,
    badgeTranslateY,
    floatAnim,
    footerOpacity,
    haloOpacity,
    haloScale,
    handleCompleteTransition,
    logoOpacity,
    logoScale,
    progressScaleX,
    subtitleOpacity,
    subtitleTranslateY,
    titleOpacity,
    titleTranslateY,
  ]);

  return (
    <TouchableOpacity
      activeOpacity={0.98}
      style={styles.touchableWrapper}
      onPress={handleCompleteTransition}
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
        {/* Rich dark gradient background */}
        <LinearGradient
          colors={['#060913', '#0B1224', '#151C38', '#1E1B4B']}
          locations={[0, 0.35, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Pulsing ambient halo circles in background */}
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
            colors={['rgba(99, 102, 241, 0.4)', 'rgba(244, 63, 94, 0.15)', 'transparent']}
            style={styles.haloGlow}
          />
        </Animated.View>

        {/* Center content */}
        <View style={styles.centerContent}>
          {/* Logo Badge with Float Effect */}
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { translateY: floatAnim }],
              },
            ]}
          >
            {/* Outer golden rim ring */}
            <View style={styles.logoOuterRim}>
              {/* Inner gradient squircle */}
              <LinearGradient
                colors={['#4F46E5', '#4338CA', '#312E81']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoBadge}
              >
                {/* Highlight gradient shine */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'transparent']}
                  style={styles.logoShine}
                />

                {/* Central Emblem: Golden Trophy & Sparkle */}
                <View style={styles.iconComposite}>
                  <Ionicons name="trophy" size={54} color="#FBBF24" />
                  <View style={styles.sparkleBadge}>
                    <Ionicons name="sparkles" size={20} color="#FDE047" />
                  </View>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Category Pill Tag */}
          <Animated.View
            style={[
              styles.categoryPill,
              {
                opacity: badgeOpacity,
                transform: [{ translateY: badgeTranslateY }],
              },
            ]}
          >
            <Ionicons name="ribbon" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.categoryPillText}>CHURCH SCORING SYSTEM</Text>
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
              Quiz Score{' '}
              <Text style={styles.titleAccent}>Manager</Text>
            </Text>
          </Animated.View>

          {/* Subtitle / Tagline */}
          <Animated.View
            style={[
              styles.subtitleContainer,
              {
                opacity: subtitleOpacity,
                transform: [{ translateY: subtitleTranslateY }],
              },
            ]}
          >
            <Text style={styles.subtitleText}>
              Real-Time Scores • Live Carry • Instant Reports
            </Text>
          </Animated.View>

          {/* Sleek Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    transform: [{ scaleX: progressScaleX }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#818CF8', '#4F46E5', '#F59E0B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>

            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        {/* Footer Hint */}
        <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
          <Text style={styles.footerHint}>Tap anywhere to enter</Text>
          <Ionicons name="chevron-forward" size={13} color="rgba(255, 255, 255, 0.4)" style={{ marginLeft: 2 }} />
        </Animated.View>
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
    backgroundColor: '#060913',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  haloContainer: {
    position: 'absolute',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloGlow: {
    width: '100%',
    height: '100%',
    borderRadius: 160,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
  },
  logoWrapper: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuterRim: {
    width: 120,
    height: 120,
    borderRadius: 36,
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)', // Warm gold accent
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 16,
  },
  logoBadge: {
    flex: 1,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  iconComposite: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
  },
  sparkleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.6)',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginBottom: 14,
  },
  categoryPillText: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  titlePrimary: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  titleAccent: {
    color: '#818CF8',
    fontWeight: '900',
  },
  subtitleContainer: {
    marginBottom: 36,
  },
  subtitleText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  progressTrack: {
    width: 190,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    width: '100%',
    height: '100%',
    transformOrigin: 'left',
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  footer: {
    position: 'absolute',
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  footerHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
