/* murmurmobile/.expo/types/router.d.ts */

import React from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface SleekButtonProps {
  label: string;
  onPress: () => void;
  isListening: boolean;
  size?: 'normal' | 'large';
}

const SleekButton: React.FC<SleekButtonProps> = ({ label, onPress, isListening, size = 'normal' }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const isLarge = size === 'large';
  const buttonStyle = [
    styles.button,
    isListening ? styles.stopButton : styles.listenButton,
    isLarge && styles.largeButton,
    animatedStyle,
  ];
  const textStyle = [styles.text, isLarge && styles.largeText];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          isListening ? styles.stopButton : styles.listenButton,
          isLarge && styles.largeButton,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={textStyle}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    elevation: 5, // for Android shadow
    shadowColor: '#000', // for iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  largeButton: {
    paddingVertical: 30,
    paddingHorizontal: 30,
    borderRadius: 150,
    width: 250,
    height: 250,
  },
  listenButton: {
    backgroundColor: '#26D0CE', // A vibrant teal
  },
  stopButton: {
    backgroundColor: '#FF4747', // A clear red
  },
  text: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  largeText: {
    fontSize: 40,
  },
});

export default SleekButton;