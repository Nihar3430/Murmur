/* murmurmobile/.expo/types/router.d.ts */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SleekButtonProps {
  label: string;
  onPress: () => void;
  isListening: boolean;
}

export default function SleekButton({ label, onPress, isListening }: SleekButtonProps) {
  const gradientColors = isListening
    ? ['#FF416C', '#FF4B2B'] // Red/Orange for 'Listening/Stop'
    : ['#1A2980', '#26D0CE']; // Blue/Cyan for 'Listen'

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        style={styles.button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.text}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  button: {
    width: 200,
    height: 70,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});