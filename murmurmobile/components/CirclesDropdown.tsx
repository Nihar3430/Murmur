import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming,
    // CRITICAL: Import runOnJS
    runOnJS
} from 'react-native-reanimated';

// Set up a constant for the animation duration and interval
const TRANSITION_DURATION = 500; // ms for fade in/out
const DISPLAY_INTERVAL = 3000; // ms for how long each item is displayed (including transition)

interface Circle {
 id: string;
  name: string;
  members: number;
  lastActive: string;
  inviteCode: string;
}

interface CirclesDropdownProps {
  circles: Circle[];
  selectedCircles: Circle[]; 
  onJoinCircle: () => void;
  onLeaveCircle: (circle: Circle) => void;
  onSelectCircle: (circle: Circle) => void; 
  onCreateCircle: () => void; 
}

export default function CirclesDropdown({ 
  circles, 
  onJoinCircle, 
  onLeaveCircle, 
  onSelectCircle,
  selectedCircles, 
  onCreateCircle 
}: CirclesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0); 
  
  const toggleDropdown = () => setIsOpen(!isOpen);

  // Reanimated shared values for opacity
  const itemOpacity = useSharedValue(1); 
  
  // --- CRITICAL FIX 1: Wrap the index advancement logic in useCallback ---
  // This ensures that runOnJS has a stable function reference.
  const advanceIndex = useCallback(() => {
    const count = selectedCircles.length;
    const fullCycleLength = count + (count > 0 ? 1 : 0);
    
    setDisplayIndex(prevIndex => (prevIndex + 1) % fullCycleLength);
    
    // Start fading the new content IN immediately after the state updates
    itemOpacity.value = withTiming(1, { duration: TRANSITION_DURATION });
  }, [selectedCircles.length, itemOpacity]); // Depend on relevant values

  // --- CRITICAL FIX 2: Define the worklet that calls the JS function (runOnJS) ---
  // This is the clean, explicit way to call a JS function from the UI thread.
  const handleFadeOutComplete = useCallback(() => {
    'worklet';
    runOnJS(advanceIndex)();
  }, [advanceIndex]);


  // --- Animation and Interval Logic ---
  useEffect(() => {
    const count = selectedCircles.length;
    const shouldAnimate = count >= 1 && !isOpen;
    const fullCycleLength = count + (count > 0 ? 1 : 0); 

    if (shouldAnimate && fullCycleLength > 1) {
      const intervalId = setInterval(() => {
        // 1. Fade OUT the current item
        itemOpacity.value = withTiming(0, { duration: TRANSITION_DURATION }, 
          handleFadeOutComplete // Pass the stable worklet callback
        );
        
      }, DISPLAY_INTERVAL);

      return () => {
          clearInterval(intervalId);
          // Cleanup: Reset opacity and index
          setDisplayIndex(0);
          itemOpacity.value = 1; 
      }
    }
    
    // Cleanup/Reset when animation is not running
    setDisplayIndex(0);
    itemOpacity.value = 1;
    
  }, [selectedCircles.length, isOpen, selectedCircles, handleFadeOutComplete]);


  // --- UI Logic Helpers ---
  const getCurrentDisplayContent = () => {
      const count = selectedCircles.length;
      
      if (count === 0) return { key: 'static', text: 'Select Circle(s)', isAnimated: false };
      
      if (displayIndex < count) {
          const circle = selectedCircles[displayIndex];
          return { key: circle.id, text: circle.name, isAnimated: true };
      }
      
      return { 
          key: 'count', 
          text: `${count} Group${count > 1 ? 's' : ''} Listening`, 
          isAnimated: true 
      };
  };

  const circleToLeave = selectedCircles[0] || null;
  const isCircleSelected = (circle: Circle) => 
    selectedCircles.some(c => c.id === circle.id);

  // --- Animated Styles ---
  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: itemOpacity.value,
  }));
  
  const currentContent = getCurrentDisplayContent();


  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleDropdown} style={styles.dropdownButton}>
        
        {/* --- Dynamic Text Container --- */}
        <View style={styles.dropdownButtonTextContainer}>
          {currentContent.isAnimated ? (
            // --- ANIMATED CONTENT PATH ---
            <Animated.Text 
              key={currentContent.key} 
              style={[styles.dropdownButtonText, animatedTextStyle]}
            >
              {currentContent.text}
            </Animated.Text>
          ) : (
            // --- STATIC CONTENT PATH (FIXED) ---
            <Text 
              style={[
                styles.dropdownButtonText, 
                // Explicitly align text center when static to ensure centering within the container
                { textAlign: 'center', width: '100%' } 
              ]}
            >
              {currentContent.text}
            </Text>
          )}
        </View>
        
        {/* Dropdown Icon */}
        <Ionicons 
          name={isOpen ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#fff" 
        />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={toggleDropdown}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={toggleDropdown}
        >
          
          <View style={styles.dropdownContent}>
            {circles.length > 0 ? (
              <>
                <FlatList<Circle>
                  data={circles}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isSelected = isCircleSelected(item);
                    return (
                      <TouchableOpacity 
                        style={styles.dropdownItem} 
                        onPress={() => onSelectCircle(item)} 
                      >
                        <View style={styles.dropdownItemContent}>
                          <View>
                            {/* The item name is already correctly wrapped in <Text> */}
                            <Text style={styles.dropdownItemText}>{item.name}</Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={24} color="#26D0CE" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
                
                {circleToLeave && (
                  <View style={styles.leaveButtonContainer}>
                    <TouchableOpacity 
                      style={styles.leaveButton} 
                      onPress={() => {
                        onLeaveCircle(circleToLeave);
                        toggleDropdown(); 
                      }}
                    >
                      <Text style={styles.leaveButtonText}>
                          {`Leave ${circleToLeave.name}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : null}
            
            <View style={styles.actionButtonContainer}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.createButton]} 
                  onPress={() => {
                    onCreateCircle();
                    toggleDropdown();
                  }}
                >
                  <Text style={styles.joinButtonText}>Create Circle</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.joinButton]} 
                  onPress={() => {
                    onJoinCircle();
                    toggleDropdown();
                  }}
                >
                  <Text style={styles.joinButtonText}>Join Circle</Text>
                </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    width: '80%',
    textAlign: 'center',
    zIndex: 1000,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  dropdownButton: {
    backgroundColor: 'rgba(91, 91, 91, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownButtonTextContainer: {
    flex: 1, 
    alignItems: 'center', // Centers children horizontally
    justifyContent: 'center', // Centers children vertically
    height: 20, 
  },
  dropdownButtonText: { 
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20, 
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500', 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dropdownContent: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
    padding: 8,
    maxHeight: 300,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  
  actionButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 8, 
    paddingBottom: 8,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRadius: 8,
  },
  joinButton: {
    backgroundColor: 'rgba(91, 91, 91, 0.9)',
  },
  createButton: {
    backgroundColor: 'rgba(38, 208, 206, 0.2)',
    borderColor: '#26D0CE',
    borderWidth: 1,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButtonContainer: {
    marginTop: 8,
    paddingHorizontal: 8, 
  },
  leaveButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: 8,
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});