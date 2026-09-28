import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, G, Circle, Text as SvgText, Polygon } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Header } from '../components/Header';
import { WheelWinnerModal } from '../components/WheelWinnerModal';
import { EditWheelModal } from '../components/EditWheelModal';
import {
  WheelStorage,
  DEFAULT_WHEEL_ITEMS,
  DEFAULT_WHEEL_NAME,
} from '../utils/wheelStorage';
import { COLORS } from '../constants/colors';
import { MainTab } from '../types';

interface WheelScreenProps {
  onNavigate: (tab: MainTab) => void;
  onOpenSettings: () => void;
}

const STUD_COUNT = 20;

const WHEEL_COLORS = [
  '#4F46E5', // Indigo
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#14B8A6', // Teal
  '#F97316', // Orange
];

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function createSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const p1 = polarToCartesian(cx, cy, r, startAngle);
  const p2 = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y} Z`;
}

export const WheelScreen: React.FC<WheelScreenProps> = ({ onOpenSettings }) => {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600 || width >= 768;

  // Responsive Wheel Sizing
  // Keeps wheel comfortably bounded horizontally and vertically across phones and tablets
  const wheelSize = useMemo(() => {
    const verticalAvailable = height - 280;
    const horizontalAvailable = isTablet ? 560 : width - 40;
    const maxAllowed = isTablet ? 420 : 310;
    return Math.max(250, Math.min(horizontalAvailable, verticalAvailable, maxAllowed));
  }, [width, height, isTablet]);

  const radius = wheelSize / 2;
  const cx = radius;
  const cy = radius;
  const sliceRadius = radius - Math.max(8, Math.round(wheelSize * 0.033));
  const numberFontSize = Math.round(wheelSize * 0.062);
  const hubSize = Math.round(wheelSize * 0.22);
  const hubFontSize = Math.round(hubSize * 0.22);
  const pointerWidth = Math.round(wheelSize * 0.115);
  const pointerHeight = Math.round(wheelSize * 0.125);
  const pointerTop = -Math.round(pointerHeight * 0.35);

  const [wheelName, setWheelName] = useState(DEFAULT_WHEEL_NAME);
  const [items, setItems] = useState<string[]>(DEFAULT_WHEEL_ITEMS);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [lastWinnerIndex, setLastWinnerIndex] = useState<number | null>(null);

  // Modals
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Animations
  const spinAnim = useMemo(() => new Animated.Value(0), []);
  const currentAngleRef = useRef(0);
  const pointerAnim = useMemo(() => new Animated.Value(0), []);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const cfg = await WheelStorage.getConfig();
      setWheelName(cfg.name);
      setItems(cfg.items);
    })();

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, []);

  const startPointerWobble = useCallback(() => {
    Animated.sequence([
      Animated.timing(pointerAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(pointerAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(pointerAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [pointerAnim]);

  const handleSpin = useCallback(() => {
    if (isSpinning) return;
    if (items.length === 0) {
      Alert.alert('Empty Wheel', 'Please tap Reset to restore numbers 1–10!');
      return;
    }
    if (items.length === 1) {
      setWinner(items[0]);
      setLastWinnerIndex(0);
      setShowWinnerModal(true);
      return;
    }

    setIsSpinning(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const fullRotations = Math.floor(Math.random() * 4) + 6; // 6 to 9 full turns
    const randomOffset = Math.random() * 360;
    const totalDelta = fullRotations * 360 + randomOffset;
    const targetAngle = currentAngleRef.current + totalDelta;

    let tickCount = 0;
    const maxTicks = 16;
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
    }
    tickIntervalRef.current = setInterval(() => {
      tickCount++;
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      startPointerWobble();
      if (tickCount >= maxTicks) {
        if (tickIntervalRef.current) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
      }
    }, 220);

    Animated.timing(spinAnim, {
      toValue: targetAngle,
      duration: 4200,
      easing: Easing.bezier(0.12, 0.8, 0.25, 1.0),
      useNativeDriver: true,
    }).start((result) => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      if (!result.finished) return;

      currentAngleRef.current = targetAngle;
      setIsSpinning(false);

      // Determine winning item under top pointer (0 deg)
      const sliceAngle = 360 / items.length;
      const normalized = (360 - (targetAngle % 360)) % 360;
      const winnerIndex = Math.min(items.length - 1, Math.floor(normalized / sliceAngle));
      const chosen = items[winnerIndex];

      setLastWinnerIndex(winnerIndex);
      setWinner(chosen);
      setShowWinnerModal(true);
    });
  }, [isSpinning, items, spinAnim, startPointerWobble]);

  const handleRemoveWinner = () => {
    if (lastWinnerIndex !== null && winner) {
      const updated = [...items];
      updated.splice(lastWinnerIndex, 1);
      setItems(updated);
      WheelStorage.saveConfig({
        name: wheelName,
        items: updated,
        initialItems: DEFAULT_WHEEL_ITEMS,
      });
    }
    setShowWinnerModal(false);
    setLastWinnerIndex(null);
  };

  const handleCloseWinner = () => {
    setShowWinnerModal(false);
    setLastWinnerIndex(null);
  };

  const handleReset = () => {
    if (isSpinning) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setItems([...DEFAULT_WHEEL_ITEMS]);
    setWinner(null);
    setLastWinnerIndex(null);
    WheelStorage.saveConfig({
      name: wheelName,
      items: [...DEFAULT_WHEEL_ITEMS],
      initialItems: [...DEFAULT_WHEEL_ITEMS],
    });
  };

  const handleSaveWheelConfig = (newName: string, newItems: string[]) => {
    setWheelName(newName);
    setItems(newItems);
    setWinner(null);
    setLastWinnerIndex(null);
    WheelStorage.saveConfig({
      name: newName,
      items: newItems,
      initialItems: newItems,
    });
  };

  // Render SVG slices for numbers 1-10
  const renderSlices = () => {
    const count = items.length;
    if (count === 0) return null;

    if (count === 1) {
      return (
        <G>
          <Circle cx={cx} cy={cy} r={sliceRadius} fill={WHEEL_COLORS[0]} stroke="#FFFFFF" strokeWidth={1.5} />
          <SvgText
            x={cx}
            y={cy + 8}
            fill="#FFFFFF"
            fontSize={numberFontSize * 1.3}
            fontWeight="900"
            textAnchor="middle"
          >
            {items[0]}
          </SvgText>
        </G>
      );
    }

    const sliceAngle = 360 / count;

    return items.map((item, index) => {
      const startAngle = index * sliceAngle;
      const endAngle = (index + 1) * sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;
      const pathData = createSlicePath(cx, cy, sliceRadius, startAngle, endAngle);
      const color = WHEEL_COLORS[index % WHEEL_COLORS.length];

      return (
        <G key={`${index}-${item}`}>
          <Path d={pathData} fill={color} stroke="#FFFFFF" strokeWidth={1.5} />
          <G transform={`rotate(${midAngle}, ${cx}, ${cy})`}>
            <SvgText
              x={cx}
              y={cy - sliceRadius * 0.62}
              fill="#FFFFFF"
              fontSize={numberFontSize}
              fontWeight="900"
              textAnchor="middle"
            >
              {item}
            </SvgText>
          </G>
        </G>
      );
    });
  };

  // Decorative dots around the rim
  const renderStuds = () => {
    const studs = [];
    const step = 360 / STUD_COUNT;
    const studDist = radius - Math.max(3, Math.round(wheelSize * 0.015));
    const studR = isTablet ? 2.8 : 2.2;

    for (let i = 0; i < STUD_COUNT; i++) {
      const angle = i * step;
      const pos = polarToCartesian(cx, cy, studDist, angle);
      studs.push(
        <Circle
          key={`stud-${i}`}
          cx={pos.x}
          cy={pos.y}
          r={studR}
          fill="#FDE047"
          stroke="#CA8A04"
          strokeWidth={0.5}
        />
      );
    }
    return studs;
  };

  const spinStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: spinAnim.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [spinAnim]
  );

  const pointerWobbleStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: pointerAnim.interpolate({
            inputRange: [-10, 10],
            outputRange: ['-10deg', '10deg'],
          }),
        },
      ],
    }),
    [pointerAnim]
  );

  return (
    <View style={styles.container}>
      <Header
        title="Random Wheel"
        subtitle="Numbers 1–10"
        onSettingsPress={onOpenSettings}
      />

      <View
        style={[
          styles.content,
          {
            paddingHorizontal: isTablet ? 32 : 20,
            paddingTop: isTablet ? 18 : 12,
            paddingBottom: isTablet ? 100 : 90,
          },
        ]}
      >
        {/* Minimal Control Bar: Wheel Title + Reset Button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.titleChip, isTablet && styles.titleChipTablet]}
            onPress={() => setShowEditModal(true)}
            activeOpacity={0.7}
            disabled={isSpinning}
          >
            <Text style={[styles.wheelNameText, isTablet && styles.wheelNameTextTablet]} numberOfLines={1}>
              {wheelName}
            </Text>
            <Ionicons name="pencil" size={isTablet ? 16 : 14} color={COLORS.primary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resetButton, isTablet && styles.resetButtonTablet]}
            onPress={handleReset}
            activeOpacity={0.7}
            disabled={isSpinning}
          >
            <Ionicons name="refresh" size={isTablet ? 17 : 15} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.resetText, isTablet && styles.resetTextTablet]}>Reset (1–10)</Text>
          </TouchableOpacity>
        </View>

        {/* Wheel Display Section */}
        <View style={styles.wheelSection}>
          <View style={{ width: wheelSize, height: wheelSize, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Pointer / Needle at Top */}
            <Animated.View
              style={[
                styles.pointerWrapper,
                pointerWobbleStyle,
                {
                  top: pointerTop,
                  width: pointerWidth,
                  height: pointerHeight,
                  left: radius - pointerWidth / 2,
                },
              ]}
            >
              <Svg width={pointerWidth} height={pointerHeight} viewBox="0 0 34 36">
                <Polygon
                  points="3,2 31,2 17,33"
                  fill="#F43F5E"
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                />
                <Circle cx={17} cy={10} r={4} fill="#FDE047" stroke="#CA8A04" strokeWidth={1} />
              </Svg>
            </Animated.View>

            {/* Rotating Wheel Graphics */}
            <Animated.View
              style={[
                styles.wheelDisk,
                spinStyle,
                { width: wheelSize, height: wheelSize, borderRadius: radius },
              ]}
            >
              <Svg width={wheelSize} height={wheelSize}>
                {/* Outer Ring */}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={radius - 2}
                  fill="#1E293B"
                  stroke="#F59E0B"
                  strokeWidth={isTablet ? 6 : 5}
                />

                {/* Slices 1-10 */}
                {renderSlices()}

                {/* Studs */}
                {renderStuds()}
              </Svg>
            </Animated.View>

            {/* Interactive Center Hub */}
            <TouchableOpacity
              style={[
                styles.centerHub,
                {
                  width: hubSize,
                  height: hubSize,
                  borderRadius: hubSize / 2,
                  borderWidth: isTablet ? 4 : 3,
                },
              ]}
              onPress={handleSpin}
              disabled={isSpinning}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#4F46E5', '#312E81']}
                style={styles.centerHubGradient}
              >
                <Text style={[styles.centerHubText, { fontSize: hubFontSize }]}>
                  {isSpinning ? '...' : 'SPIN'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Big Minimal SPIN Button */}
        <View style={styles.buttonSection}>
          {items.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptyRestoreButton, isTablet && styles.emptyRestoreButtonTablet]}
              onPress={handleReset}
            >
              <Ionicons name="refresh" size={isTablet ? 20 : 18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.emptyRestoreText, isTablet && styles.emptyRestoreTextTablet]}>Restore Numbers 1–10</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.spinButton,
                isTablet && styles.spinButtonTablet,
                isSpinning && styles.spinButtonDisabled,
              ]}
              onPress={handleSpin}
              disabled={isSpinning}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isSpinning ? ['#94A3B8', '#64748B'] : ['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.spinGradient}
              >
                <Ionicons
                  name={isSpinning ? 'hourglass-outline' : 'disc'}
                  size={isTablet ? 24 : 20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.spinText, isTablet && styles.spinTextTablet]}>
                  {isSpinning ? 'SPINNING...' : 'SPIN'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Winner Modal */}
      <WheelWinnerModal
        visible={showWinnerModal}
        winner={winner}
        wheelName={wheelName}
        remainingCount={items.length}
        onRemove={handleRemoveWinner}
        onClose={handleCloseWinner}
      />

      {/* Edit Wheel Modal */}
      <EditWheelModal
        visible={showEditModal}
        wheelName={wheelName}
        items={items}
        onSave={handleSaveWheelConfig}
        onClose={() => setShowEditModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  titleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: '55%',
  },
  titleChipTablet: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  wheelNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  wheelNameTextTablet: {
    fontSize: 15,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  resetTextTablet: {
    fontSize: 14,
  },
  wheelSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginVertical: 10,
  },
  pointerWrapper: {
    position: 'absolute',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
  wheelDisk: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  centerHub: {
    position: 'absolute',
    zIndex: 15,
    borderColor: '#FDE047',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
    overflow: 'hidden',
  },
  centerHubGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerHubText: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 8,
  },
  spinButton: {
    width: '100%',
    maxWidth: 280,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  spinButtonTablet: {
    maxWidth: 340,
    height: 56,
    borderRadius: 28,
  },
  spinButtonDisabled: {
    shadowOpacity: 0.1,
  },
  spinGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  spinTextTablet: {
    fontSize: 18,
  },
  emptyRestoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    width: '100%',
    maxWidth: 280,
  },
  emptyRestoreButtonTablet: {
    maxWidth: 340,
    height: 54,
    borderRadius: 27,
  },
  emptyRestoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyRestoreTextTablet: {
    fontSize: 16,
  },
});
