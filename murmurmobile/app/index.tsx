// murmurmobile/app/index.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av'; // For mic access
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';

import SleekButton from '@/components/SleekButton';
import Visualizer from '@/components/Visualizer';
import RiskIndicators from '@/components/RiskIndicators';
import CirclesDropdown from '@/components/CirclesDropdown';
import JoinCircleModal from '@/components/JoinCircle';
import {Recording} from "expo-av/build/Audio/Recording";

const { height } = Dimensions.get('window');

// *** IMPORTANT: REPLACE WITH YOUR LAPTOP'S ACTUAL LOCAL IP ADDRESS ***
const SERVER_IP = '10.108.189.206'; // Or your machine's local IP
const SERVER_PORT = 5000;
const BASE_URL = `http://${SERVER_IP}:${SERVER_PORT}`;

// *** CONSTANT: Define the offset for the final position (e.g., 10% higher) ***
// 💡 MODIFIED: Increased to 0.2 (20%) to move the screen higher
const CONTENT_OFFSET_RATIO = 0.16;

// --- Data Structures ---
interface TriggerState {
  isJump: boolean;
  isEvent: boolean;
  isText: boolean;
}
const initialTriggers: TriggerState = { isJump: false, isEvent: false, isText: false };

// Circle interface for mock data
interface Circle {
  id: string;
  name: string;
  members: number;
  lastActive: string;
  inviteCode: string;
}


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

// --- CONSTANT: Calculate the area where the content lives (everything below the title) ---
const HEADER_HEIGHT = 100; // Approximate height for Header + margins
const SLIDE_HEIGHT = height - HEADER_HEIGHT; // The height of the area that slides


export default function MurmurHomeScreen() {
  const [isListening, setIsListening] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const lastNotificationTime = useRef<number>(0);
  const [triggers, setTriggers] = useState<TriggerState>(initialTriggers);
  const [visualizerData, setVisualizerData] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState('Ready to Listen');
  const [db, setDb] = useState(-99.9); // Raw dB from mic for meter

  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);

  // Mock data for circles dropdown
  const [circles, setCircles] = useState<Circle[]>([
    {
      id: '1',
      name: 'Family Circle',
      members: 5,
      lastActive: '2 min ago',
      inviteCode: '345123'
    },
    {
      id: '2',
      name: 'College Friends',
      members: 8,
      lastActive: '15 min ago',
      inviteCode: '827364'
    },
    {
      id: '3',
      name: 'Roommates',
      members: 3,
      lastActive: '1 hour ago',
      inviteCode: '982879'
    }
  ]);

  const handleCircleSelect = (circle: Circle) => {
    setSelectedCircle(circle);
  }

  const [joinedCircles, setJoinedCircles] = useState<Circle[]>([]);
  const recording = useRef<Audio.Recording | null>(null);


  // All hooks and logic are declared above
  const mlLoopTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reanimated values for the max-danger alert animation
  const riskScale = useSharedValue(1);
  const bgColor = useSharedValue('#000');

  // Start contentTranslateY at `SLIDE_HEIGHT` (off-screen bottom)
  const contentTranslateY = useSharedValue(SLIDE_HEIGHT);

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
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
          provideAppNotificationSettings: true,
        },
      });
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please enable notifications to receive alerts.');
      }
      console.log('Notification permissions status:', status);
    })();
  }, []);

  // Send notification based on risk level
  const sendRiskNotification = async (risk: number, event?: string) => {
    const now = Date.now();

    // Prevent notification spam by requiring 10 seconds between notifications
    if (now - lastNotificationTime.current < 10000) {
      return;
    }

    if (risk >= 0.74) {
      try {
        const notificationContent: any = {
          title: '⚠️ Risk Alert',
          body: event
            ? `${event} detected in area!`
            : `Risk Level over ${(risk * 100).toFixed(1)}%`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        };

        if (Platform.OS === 'android') {
          notificationContent.vibrationPattern = [0, 250, 250, 250];
          notificationContent.android = {
            priority: Notifications.AndroidNotificationPriority.HIGH,
            vibrate: true
          };
        } else if (Platform.OS === 'ios') {
          notificationContent.sound = 'default';
          notificationContent.interruptionLevel = 'critical';
        }

        await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: null,
        });
        lastNotificationTime.current = now;
      } catch (error) {
        console.error('Failed to schedule notification:', error);
      }
    }
  };

  // --- ML Server Communication Loop ---
  const startMLServerLoop = () => {
    if (mlLoopTimer.current) clearInterval(mlLoopTimer.current);

    fetch(`${BASE_URL}/start`, { method: 'POST' });

    mlLoopTimer.current = setInterval(async () => {
      try {
        const response = await fetch(`${BASE_URL}/get_analysis`, { method: 'GET' });
        const data = await response.json();

        if (data.status === 'analyzing') {
            const risk = parseFloat(data.risk);
            setRiskScore(Math.round(risk * 100));
            setTriggers({
                isJump: data.isJump,
                isEvent: data.isEvent,
                isText: data.isText,
            });
            setStatusMessage(`Last Event: ${data.event_top[0].label} | Transcript: ${data.transcript}`);

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
    }, 500);
  };

  const stopMLServerLoop = () => {
    if (mlLoopTimer.current) {
      clearInterval(mlLoopTimer.current);
      mlLoopTimer.current = null;
    }
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
        100
      );
      recording.current = newRecording;

      newRecording.setOnRecordingStatusUpdate(status => {
        if (status.metering !== undefined) {
          const newDb = status.metering as number;
          setDb(newDb);
          const normalizedHeight = getNormalizedBarHeight(newDb);

          const newVisualizerData = Array.from({ length: 30 }, (_, i) => {
              const centerIndex = 15;
              const distance = Math.abs(i - centerIndex);
              const factor = 1 - (distance / centerIndex) ** 2;
              return normalizedHeight * factor * 0.7 + (Math.random() * 0.1);
          });
          setVisualizerData(newVisualizerData);
        }
      });

      newRecording.setProgressUpdateInterval(100);
      setIsListening(true);
      startMLServerLoop();

    } catch (err) {
      console.error('Failed to start recording', err);
      setStatusMessage('Error starting mic. Check server connection.');
      stopRecording();
    }
  };

  const stopRecording = async () => {
    setStatusMessage('Ready to Listen');
    setIsListening(false);

    setVisualizerData([]);
    setDb(-99.9);
    setRiskScore(0.0);
    setTriggers(initialTriggers);
    stopMLServerLoop();
    try {
      if (recording.current) {
        if (recording.current instanceof Recording) {
          await recording.current.stopAndUnloadAsync();
        }
        recording.current = null;
      }
    } catch (error) { /* ignored */ }
  };

  
  // --- CIRCLES DROPDOWN LOGIC ---
  const handleJoinCircle = () => {
    setIsJoinModalVisible(true);
  };

  const handleJoinWithCode = (code: string) => {
  const circle = circles.find(c => c.inviteCode === code);
  if (circle) {
    if (joinedCircles.some(c => c.id === circle.id)) {
      Alert.alert('Already Joined', 'You are already a member of this circle');
    } else {
      setJoinedCircles([...joinedCircles, circle]);
      setSelectedCircle(circle);
      Alert.alert('Success', `Joined ${circle.name}!`);
    }
  } else {
    Alert.alert('Invalid Code', 'No circle found with this invite code');
  }
  setIsJoinModalVisible(false);
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
    const isAlerting = riskScore >= 70.0;
    riskScale.value = withSpring(isAlerting ? 1.2 : 1, { stiffness: 50, damping: 10 });
    bgColor.value = withTiming(
        isAlerting ? '#4C0000' : '#1C1C1C',
        { duration: 500 }
    );
  }, [riskScore]);

  // *** UPDATED: Slide-up/Slide-down animation logic for content ***
  useEffect(() => {
    // 💡 MODIFIED: finalListeningPosition uses the updated CONTENT_OFFSET_RATIO
    const finalListeningPosition = -SLIDE_HEIGHT * CONTENT_OFFSET_RATIO;
    const finalStopPosition = SLIDE_HEIGHT;

    if (isListening) {
      // Slide up
      contentTranslateY.value = withSpring(finalListeningPosition, {
        stiffness: 150,
        damping: 15,
        mass: 1,
        velocity: 4,
      });
    } else {
      // Slide down
      contentTranslateY.value = withTiming(finalStopPosition, {
        duration: 500,
      });
    }
  }, [isListening]);


  // Animated styles...
  const animatedContainerStyle = useAnimatedStyle(() => ({ backgroundColor: bgColor.value }));

  const animatedRiskTextStyle = useAnimatedStyle(() => {
    const riskColor = riskScore >= 70.0 ? '#FF0000' : riskScore >= 40.0 ? '#FFBB33' : '#26D0CE';
    return { transform: [{ scale: riskScale.value }], color: riskColor };
  });

  // *** CRITICAL CHANGE: Controls the sliding of the active screen ***
  const animatedContentStyle = useAnimatedStyle(() => {
    return {
        transform: [{ translateY: contentTranslateY.value }],
        // Content is transparent, revealing the animated app background behind it
        backgroundColor: 'transparent',
        pointerEvents: isListening ? 'auto' : 'none',
    };
  });

  // Animated style for the main listen screen content to hide/show
  const listenContentOpacity = useSharedValue(1);
  useEffect(() => {
      listenContentOpacity.value = withTiming(isListening ? 0 : 1, { duration: 250 });
  }, [isListening]);

  const animatedCenteredContentStyle = useAnimatedStyle(() => ({
      opacity: listenContentOpacity.value,
      zIndex: isListening ? 0 : 1,
      pointerEvents: isListening ? 'none' : 'auto', 
  }));

  // Single return statement at the end
  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <SafeAreaView style={styles.safeArea}>
        <CirclesDropdown 
          circles={joinedCircles} 
          onJoinCircle={handleJoinCircle}
          selectedCircle={selectedCircle}
          onSelectCircle={handleCircleSelect}
        />
        <JoinCircleModal
          visible={isJoinModalVisible}
          onClose={() => setIsJoinModalVisible(false)}
          onJoin={handleJoinWithCode}
        />
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>MURMUR</Text>
          </View>

          {/* The initial 'LISTEN' screen content. It animates opacity to disappear/reappear. */}
          <Animated.View style={[styles.centeredContent, animatedCenteredContentStyle]}>
            <SleekButton
              label="LISTEN"
              onPress={handlePress}
              isListening={isListening}
              size="large"
            />
            <Text style={[styles.statusText, {marginBottom: 0, marginTop: 20}]}>
              {statusMessage}
            </Text>
          </Animated.View>

          {/* The container for the sliding listening screen. It is absolutely positioned right below the header area. */}
          <View style={styles.slideAreaContainer}>
            <Animated.View style={[styles.listeningContent, animatedContentStyle]}>
              <View style={styles.visualizerArea}>
                <Visualizer isListening={isListening} data={visualizerData} />
                <Text style={styles.dbText}>Live dBFS: {db.toFixed(1)}</Text>
              </View>

              <View style={styles.riskArea}>
                <Text style={styles.riskLabel}>CURRENT RISK</Text>
                <Animated.Text style={[styles.riskScore, animatedRiskTextStyle]}>
                  {`${riskScore}%`}
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

              <Text style={styles.statusText}>
                {statusMessage}
              </Text>
            </Animated.View>
          </View>

        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    // This defines the area that is NOT covered by the slide-up screen
    marginTop: 50,
    height: HEADER_HEIGHT, 
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 2,
  },
  // Container for the LISTEN button content
  centeredContent: {
    // Takes up the rest of the vertical space
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  // *** NEW CONTAINER for the sliding screen area ***
  slideAreaContainer: {
    // Absolute position to float over the centeredContent/LISTEN button area
    position: 'absolute',
    top: HEADER_HEIGHT, // Starts right below the header
    height: SLIDE_HEIGHT, // The full sliding height
    width: '100%',
    overflow: 'hidden', // Crucial to clip the content as it slides out/in
  },
  // The content itself
  listeningContent: {
    // Full height of its container (SLIDE_HEIGHT)
    height: SLIDE_HEIGHT, 
    alignItems: 'center',
    width: '100%',
    paddingTop: 0, // No extra padding needed here since slideAreaContainer handles the offset
    backgroundColor: '#000',
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
    marginBottom: 100, 
  },
  statusText: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});