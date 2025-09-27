import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface TriggerState {
  isJump: boolean; // Tier 1: DbJumpMeter (Jumped above threshold)
  isEvent: boolean; // Tier 2: SpectrogramEventClassifier (Scream/Gasp/Gunshot)
  isText: boolean; // Tier 3: TriggerTextJudge (Dangerous keyword)
}

interface RiskIndicatorsProps {
  triggers: TriggerState;
}

const Indicator = ({ isActive, color, iconName, label }: { isActive: boolean; color: string; iconName: string; label: string }) => {
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (isActive) {
      // Start infinite pulse animation when active
      pulse.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1, // -1 means infinite repeat
        true // Reverse the animation
      );
    } else {
      // Stop animation and reset scale when inactive
      pulse.value = withTiming(0, { duration: 500 });
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [1, 1.4]);
    const opacity = interpolate(pulse.value, [0, 1], [0.5, 0.1]);

    return {
      transform: isActive ? [{ scale }] : [{ scale: 1 }],
      opacity: isActive ? opacity : 0,
    };
  });

  return (
    <View style={styles.indicatorWrapper}>
      <View style={[styles.ring, { borderColor: color }]}>
        {/* Animated Pulse Ring */}
        <Animated.View style={[styles.pulseRing, animatedStyle, { backgroundColor: color }]} />

        {/* Core Icon */}
        <View style={[styles.core, { backgroundColor: isActive ? color : '#333' }]}>
          <MaterialCommunityIcons name={iconName as any} size={28} color="white" />
        </View>
      </View>
      <Text style={[styles.indicatorText, { color: isActive ? color : '#555' }]}>{label}</Text>
    </View>
  );
};

export default function RiskIndicators({ triggers }: RiskIndicatorsProps) {
  return (
    <View style={styles.container}>
      <Indicator
        isActive={triggers.isJump}
        color="#FFBB33" // Yellow/Orange
        iconName="volume-high"
        label="Volume Jump"
      />
      <Indicator
        isActive={triggers.isEvent}
        color="#FF4B2B" // Red
        iconName="microphone-alert"
        label="Event Classified"
      />
      <Indicator
        isActive={triggers.isText}
        color="#4D4DFF" // Blue/Purple
        iconName="script-text-outline"
        label="Text Classified"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 20,
  },
  indicatorWrapper: {
    alignItems: 'center',
    width: 100,
  },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  core: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  }
});