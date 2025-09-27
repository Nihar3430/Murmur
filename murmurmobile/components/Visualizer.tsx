import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const BAR_COUNT = 30;
const BAR_WIDTH = 5;
const MAX_HEIGHT = 150;

interface VisualizerProps {
  isListening: boolean;
  // A simulated array of normalized dBFS values (0 to 1)
  data: number[];
}

const AnimatedBar = ({ heightValue }: { heightValue: number }) => {
  const barHeight = useSharedValue(0);

  React.useEffect(() => {
    barHeight.value = withTiming(
      heightValue * MAX_HEIGHT,
      {
        duration: 100, // Fast update to feel real-time
        easing: Easing.linear,
      }
    );
  }, [heightValue]);

  const animatedStyle = useAnimatedStyle(() => {
    // Interpolate the height and opacity
    const opacity = interpolate(barHeight.value, [0, MAX_HEIGHT], [0.3, 1]);
    const backgroundColor = interpolate(barHeight.value, [0, MAX_HEIGHT * 0.5, MAX_HEIGHT],
      ['#26D0CE', '#4D4DFF', '#FF416C'] // Blue to Purple to Red
    );

    return {
      height: barHeight.value + 1, // +1 for minimum visibility
      opacity,
      backgroundColor,
    };
  });

  return <Animated.View style={[styles.bar, animatedStyle]} />;
};

export default function Visualizer({ isListening, data }: VisualizerProps) {
  if (!isListening) {
    return (
      <View style={[styles.container, { height: MAX_HEIGHT, justifyContent: 'center' }]}>
        <Text style={styles.placeholderText}>Press 'Listen' to start monitoring.</Text>
      </View>
    );
  }

  // Use the provided data or generate a safe placeholder if data is too small
  const displayData = data.slice(0, BAR_COUNT);
  const remainingBars = BAR_COUNT - displayData.length;

  // Add zeros for any missing bars to maintain visual width
  for (let i = 0; i < remainingBars; i++) {
    displayData.push(0);
  }

  return (
    <View style={styles.container}>
      {displayData.map((height, index) => (
        <AnimatedBar key={index} heightValue={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: width * 0.9,
    height: MAX_HEIGHT,
    paddingHorizontal: 10,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    marginHorizontal: 1,
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
  }
});