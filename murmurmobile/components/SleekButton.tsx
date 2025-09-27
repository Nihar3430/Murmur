import React, { useEffect } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  withSpring,
} from "react-native-reanimated";

interface SleekButtonProps {
  label: string;
  onPress: () => void;
  isListening: boolean;
  size?: "normal" | "large";
}

const SleekButton: React.FC<SleekButtonProps> = ({
  label,
  onPress,
  isListening,
  size = "normal",
}) => {
  const glow = useSharedValue(0.6); // controls glow strength

  // press feedback animation (shrinks button slightly)
  const handlePressIn = () => {
    glow.value = withSpring(0.4);
  };

  const handlePressOut = () => {
    glow.value = withSpring(0.6);
  };

  // pulse only when NOT listening
  useEffect(() => {
    if (!isListening) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }), // brighter glow
          withTiming(0.4, { duration: 1000 }) // dimmer glow
        ),
        -1, // infinite
        true
      );
    } else {
      cancelAnimation(glow);
      glow.value = withSpring(0.6); // reset when listening
    }
  }, [isListening]);

  // glow style (animated shadow effect)
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value,
    shadowRadius: 30 * glow.value,
  }));

  const isLarge = size === "large";
  const textStyle = [styles.text, isLarge && styles.largeText];

  return (
    <Animated.View
      style={[
        styles.glowWrapper,
        glowStyle,
        isLarge && styles.largeGlowWrapper,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          isListening ? styles.stopButton : styles.listenButton,
          isLarge && styles.largeButton,
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Text style={textStyle}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  glowWrapper: {
    shadowColor: "#f25b5bff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 100,
    shadowRadius: 100,
    borderRadius: 200,
    alignSelf: "center",
  },
  largeGlowWrapper: {
    shadowRadius: 100,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 220,
  },
  largeButton: {
    paddingVertical: 30,
    paddingHorizontal: 30,
    borderRadius: 150,
    width: 250,
    height: 250,
  },
  listenButton: {
    backgroundColor: "#FF4747",
  },
  stopButton: {
    backgroundColor: "#FF4747",
  },
  text: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
  },
  largeText: {
    fontSize: 40,
  },
});

export default SleekButton;
