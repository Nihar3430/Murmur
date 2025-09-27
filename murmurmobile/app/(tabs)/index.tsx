/* murmurmobile/// *** IMPORTANT: REPLACE WITH YOUR LAPTOP'S ACTUAL LOCAL IP ADDRESS ***
const SERVER_IP = '10.108.161.1            // Send notification if risk is high
            console.log('Current risk:', risk, 'isEvent:', data.isEvent);
            if (data.isEvent || risk >= 0.74) {
                console.log('Attempting to send notification...');
                try {
                    await sendRiskNotification(risk, data.event_top[0].label);
                    console.log('Notification sent successfully');
                } catch (error) {
                    console.error('Failed to send notification:', error);
                }
            } // Or your machine's local IP
const SERVER_PORT = 5000;
const BASE_URL = `http://${SERVER_IP}:${SERVER_PORT}`;(tabs)/index.tsx */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av'; // For mic access
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';

import SleekButton from '../../components/SleekButton';
import Visualizer from '../../components/Visualizer';
import RiskIndicators from '../../components/RiskIndicators';
import {Recording} from "expo-av/build/Audio/Recording";

const { height } = Dimensions.get('window');

// *** IMPORTANT: REPLACE WITH YOUR LAPTOP'S ACTUAL LOCAL IP ADDRESS ***
const SERVER_IP = '10.108.161.163'; // Or your machine's local IP
const SERVER_PORT = 5000;
const BASE_URL = `http://${SERVER_IP}:${SERVER_PORT}`;

// --- Data Structures ---
interface TriggerState {
  isJump: boolean;
  isEvent: boolean;
  isText: boolean;
}
const initialTriggers: TriggerState = { isJump: false, isEvent: false, isText: false };

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function MurmurHomeScreen() {
  const [isListening, setIsListening] = useState(false);
  const [riskScore, setRiskScore] = useState(0.0);
  const lastNotificationTime = useRef<number>(0);
  const [triggers, setTriggers] = useState<TriggerState>(initialTriggers);
  const [visualizerData, setVisualizerData] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState('Ready to Listen');
  const [db, setDb] = useState(-99.9); // Raw dB from mic for meter

  const recording = useRef<Audio.Recording | null>(null);
  const mlLoopTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reanimated values for the max-danger alert animation
  const riskScale = useSharedValue(1);
  const bgColor = useSharedValue('#1C1C1C');

  // --- Helper: Convert Raw dB to Normalized Height (0 to 1) ---
  const getNormalizedBarHeight = (db: number): number => {
    const dB_MIN = -60;
    const dB_MAX = 0;
    // Map -60..0 to 0..1, clamping outside this range
    return Math.min(1, Math.max(0, (db - dB_MIN) / (dB_MAX - dB_MIN)));
  };

  // Request notification permissions
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please enable notifications to receive alerts.');
      }
    })();
  }, []);

  // Send notification based on risk level
  const sendRiskNotification = async (risk: number, event?: string) => {
    const now = Date.now();
    console.log('Attempting notification, last notification was:', now - lastNotificationTime.current, 'ms ago');
    
    // Prevent notification spam by requiring 10 seconds between notifications
    if (now - lastNotificationTime.current < 10000) {
      console.log('Skipping notification - too soon since last one');
      return;
    }
    
    if (risk >= 0.74) {
      console.log('Risk threshold met, sending notification...');
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Risk Alert',
            body: event 
              ? `Risk Level: ${(risk * 100).toFixed(1)}% - ${event}` 
              : `Risk Level: ${(risk * 100).toFixed(1)}%`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Send immediately
        });
        lastNotificationTime.current = now;
        console.log('Notification scheduled successfully');
      } catch (error) {
        console.error('Failed to schedule notification:', error);
      }
    }
  };

  // --- ML Server Communication Loop ---
  const startMLServerLoop = () => {
    if (mlLoopTimer.current) clearInterval(mlLoopTimer.current);

    // 1. Tell the server to initialize and start its ML analysis thread
    fetch(`${BASE_URL}/start`, { method: 'POST' });

    // 2. Poll the server periodically for the latest analysis results (tick data)
    mlLoopTimer.current = setInterval(async () => {
      try {
        const response = await fetch(`${BASE_URL}/get_analysis`, { method: 'GET' });
        const data = await response.json();

        if (data.status === 'analyzing') {
            const risk = parseFloat(data.risk);
            setRiskScore(risk);
            setTriggers({
                isJump: data.isJump,
                isEvent: data.isEvent,
                isText: data.isText,
            });
            setStatusMessage(`Last Event: ${data.event_top[0].label} | Transcript: ${data.transcript}`);
            
            // Send notification if risk is high
            if (data.isEvent || risk >= 0.74) {
                await sendRiskNotification(risk, data.event_top[0].label);
            }
        } else if (data.status === 'warming_up') {
            setStatusMessage('Server warming up: Calibrating ambient noise...');
        } else {
            setStatusMessage(`Server Status: ${data.status}`);
        }

      } catch (error) {
        console.error("ML Server connection error:", error);
        setStatusMessage('Connection Error. Check Server IP/Port.');
      }
    }, 500); // Polling every 500ms (matches your `chunk_seconds`)
  };

  const stopMLServerLoop = () => {
    if (mlLoopTimer.current) {
      clearInterval(mlLoopTimer.current);
      mlLoopTimer.current = null;
    }
    // Tell the server to shut down its ML analysis thread
    fetch(`${BASE_URL}/stop`, { method: 'POST' });
  };

  // --- AUDIO LOGIC: Start/Stop Recording & Metering ---
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission denied', 'Mic permission is required.');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        100 // Interval for metering updates
      );
      recording.current = newRecording;

      // Update UI with real dB meter data
      newRecording.setOnRecordingStatusUpdate(status => {
        if (status.metering !== undefined) {
          const newDb = status.metering as number;
          setDb(newDb);
          const normalizedHeight = getNormalizedBarHeight(newDb);

          // Create a dynamic visualizer wave based on the real dB
          const newVisualizerData = Array.from({ length: 30 }, (_, i) => {
              const centerIndex = 15;
              const distance = Math.abs(i - centerIndex);
              const factor = 1 - (distance / centerIndex) ** 2; // Parabolic decay from center
              return normalizedHeight * factor * 0.7 + (Math.random() * 0.1);
          });
          setVisualizerData(newVisualizerData);
        }
      });

      newRecording.setProgressUpdateInterval(100);
      setIsListening(true);
      startMLServerLoop(); // START SERVER COMMUNICATION

    } catch (err) {
      console.error('Failed to start recording', err);
      setStatusMessage('Error starting mic. Check server connection.');
      stopRecording();
    }
  };

  const stopRecording = async () => {
    setIsListening(false);
    setStatusMessage('Ready to Listen');
    setVisualizerData([]);
    setDb(-99.9);
    setRiskScore(0.0);
    setTriggers(initialTriggers);
    stopMLServerLoop(); // STOP SERVER COMMUNICATION
    try {
      if (recording.current) {
        if (recording.current instanceof Recording) {
          await recording.current.stopAndUnloadAsync();
        }
        recording.current = null;
      }
    } catch (error) { /* ignored */ }
  };

  const handlePress = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening]);

  // --- ALERT & ANIMATION LOGIC (Driven by riskScore from server) ---
  useEffect(() => {
    const isAlerting = riskScore >= 0.7;
    riskScale.value = withSpring(isAlerting ? 1.2 : 1, { stiffness: 50, damping: 10 });
    bgColor.value = withTiming(
        isAlerting ? '#4C0000' : '#1C1C1C',
        { duration: 500 }
    );
  }, [riskScore]);

  // Animated styles...
  const animatedContainerStyle = useAnimatedStyle(() => ({ backgroundColor: bgColor.value }));
  const animatedRiskTextStyle = useAnimatedStyle(() => {
    const riskColor = riskScore >= 0.7 ? '#FF0000' : riskScore >= 0.4 ? '#FFBB33' : '#26D0CE';
    return { transform: [{ scale: riskScale.value }], color: riskColor };
  });

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>MURMUR</Text>
            </View>

            {isListening ? (
              <>
                <View style={styles.visualizerArea}>
                    <Visualizer isListening={isListening} data={visualizerData} />
                    <Text style={styles.dbText}>Live dBFS: {db.toFixed(1)}</Text>
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
                        label="STOP"
                        onPress={handlePress}
                        isListening={isListening}
                    />
                </View>
              </>
            ) : (
              <View style={styles.centeredContent}>
                <SleekButton
                    label="LISTEN"
                    onPress={handlePress}
                    isListening={isListening}
                    size="large"
                />
              </View>
            )}

            <Text style={styles.statusText}>
                {statusMessage}
            </Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C',
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 2,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizerArea: {
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  dbText: {
    color: '#888',
    fontSize: 14,
    marginTop: 10
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
    minWidth: 200,
    textAlign: 'center',
  },
  buttonArea: {
    marginTop: 'auto',
    marginBottom: 40,
  },
  statusText: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});