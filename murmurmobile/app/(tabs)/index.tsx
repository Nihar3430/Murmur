import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import SleekButton from '../../components/SleekButton';
import Visualizer from '../../components/Visualizer';
import RiskIndicators from '../../components/RiskIndicators';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

const { height } = Dimensions.get('window');

// --- SIMULATED ML LOGIC OUTPUT STRUCTURE ---
interface TriggerState {
  isJump: boolean;
  isEvent: boolean;
  isText: boolean;
}

const initialTriggers: TriggerState = { isJump: false, isEvent: false, isText: false };

export default function MurmurHomeScreen() {
  const [isListening, setIsListening] = useState(false);
  const [riskScore, setRiskScore] = useState(0.0);
  const [triggers, setTriggers] = useState<TriggerState>(initialTriggers);
  const [visualizerData, setVisualizerData] = useState<number[]>([]);

  // Reanimated values for the max-danger alert animation
  const riskScale = useSharedValue(1);
  const bgColor = useSharedValue('#1C1C1C'); // Dark background

  // --- SIMULATION OF CONTINUOUS ML LOGIC ---
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isListening) {
      interval = setInterval(() => {
        // 1. Simulate Visualizer Data (dBFS/Spectral Data)
        const newData = Array.from({ length: 30 }, () => Math.random() * 0.4); // Low ambient noise

        // 2. Simulate Risk Score & Triggers
        let newRisk = riskScore;
        let newTriggers = { ...initialTriggers };

        // 2a. Simple rising risk simulation
        if (Math.random() < 0.1) { // 10% chance to jump risk
          newRisk = Math.min(1.0, riskScore + 0.1 + Math.random() * 0.1);
          newTriggers.isJump = newRisk > 0.2; // dB Jump at 0.2
        } else if (riskScore > 0) {
          newRisk = Math.max(0.0, riskScore - 0.05); // Decay
        }

        // 2b. Randomly fire T2 and T3 for demo
        if (newRisk > 0.4 && Math.random() < 0.3) {
            newTriggers.isEvent = true;
        }
        if (newRisk > 0.6 && Math.random() < 0.2) {
            newTriggers.isText = true;
        }

        // 2c. Simulate full danger for alert test
        if (newRisk >= 0.8) {
             newTriggers.isJump = newTriggers.isEvent = newTriggers.isText = true;
             newRisk = 1.0;
        }

        // Apply final state
        setRiskScore(newRisk);
        setTriggers(newTriggers);

        // Add loud data if risk is high
        if (newRisk > 0.5) {
            for (let i = 0; i < 5; i++) {
                newData[i] = Math.random() * (0.5 + newRisk * 0.5);
            }
        }
        setVisualizerData(newData);

      }, 250); // Updates 4 times per second
    } else {
      setVisualizerData([]);
      setRiskScore(0.0);
      setTriggers(initialTriggers);
    }

    return () => clearInterval(interval);
  }, [isListening, riskScore]);


  // --- ALERT & ANIMATION LOGIC (TIER 3 ALERT_MIN_SCORE = 0.6) ---
  useEffect(() => {
    const isAlerting = riskScore >= 0.7; // High risk threshold for UI

    // Animate the Risk Score for visual urgency
    riskScale.value = withSpring(isAlerting ? 1.2 : 1, { stiffness: 50, damping: 10 });

    // Animate background color on max danger
    bgColor.value = withTiming(
        isAlerting ? '#4C0000' : '#1C1C1C', // Dark Red for max danger
        { duration: 500 }
    );

    if (isAlerting && isListening) {
      // Hypothetical alert logic
      // Alert.alert("MAX DANGER ALERT", "All three tiers triggered. Reporting authorities.");
    }
  }, [riskScore, isListening]);

  // Animated style for the whole view
  const animatedContainerStyle = useAnimatedStyle(() => {
    return { backgroundColor: bgColor.value };
  });

  // Animated style for the Risk Score text
  const animatedRiskTextStyle = useAnimatedStyle(() => {
    const riskColor = riskScore >= 0.7 ? '#FF0000' : riskScore >= 0.4 ? '#FFBB33' : '#26D0CE';
    return {
      transform: [{ scale: riskScale.value }],
      color: riskColor,
    };
  });

  const handlePress = useCallback(() => {
    setIsListening(prev => !prev);
  }, []);

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />

        <View style={styles.header}>
            <Text style={styles.title}>Murmur Safety</Text>
        </View>

        <View style={styles.visualizerArea}>
            <Visualizer isListening={isListening} data={visualizerData} />
        </View>

        <View style={styles.riskArea}>
            <Text style={styles.riskLabel}>CURRENT RISK</Text>
            <Animated.Text style={[styles.riskScore, animatedRiskTextStyle]}>
                {riskScore.toFixed(2)}
            </Animated.Text>
        </View>

        <RiskIndicators triggers={triggers} />

        <View style={styles.buttonArea}>
            <SleekButton
                label={isListening ? 'STOP' : 'LISTEN'}
                onPress={handlePress}
                isListening={isListening}
            />
        </View>

        <Text style={styles.statusText}>
            {isListening ? 'Monitoring in Real-Time...' : 'Ready to Listen'}
        </Text>

      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C', // Deep dark background
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    paddingTop: height * 0.05,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 2,
  },
  visualizerArea: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  riskArea: {
    alignItems: 'center',
    marginVertical: 30,
  },
  riskLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#888',
    marginBottom: 5,
  },
  riskScore: {
    fontSize: 80,
    fontWeight: '900',
    color: '#26D0CE',
    minWidth: 200, // Ensure it doesn't jump width
    textAlign: 'center',
  },
  buttonArea: {
    marginTop: 'auto', // Push to bottom
    marginBottom: 40,
  },
  statusText: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 10,
  }
});