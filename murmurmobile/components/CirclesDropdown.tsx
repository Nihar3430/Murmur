import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming
} from 'react-native-reanimated';

// Set up a constant for the animation duration and interval
const TRANSITION_DURATION = 500; // ms for fade in/out
const DISPLAY_INTERVAL = 3000; // ms for how long each text is visible

interface Circle {
  id: string;
  name: string;
  members: number;
  lastActive: string;
  inviteCode: string;
}

interface CirclesDropdownProps {
  circles: Circle[];
  selectedCircle: Circle | null;
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
  selectedCircle, 
  onCreateCircle 
}: CirclesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showGroupName, setShowGroupName] = useState(true); // Toggles between name (true) and count (false)
  const toggleDropdown = () => setIsOpen(!isOpen);

  // Reanimated shared values for opacity
  const nameOpacity = useSharedValue(1);
  const countOpacity = useSharedValue(0);

  // --- Animation and Interval Logic ---
  useEffect(() => {
    // Animation runs only if a group IS selected AND the modal is closed.
    const shouldAnimate = selectedCircle && !isOpen;
    
    if (shouldAnimate) {
      const intervalId = setInterval(() => {
        // Toggle the state to switch the text being displayed
        setShowGroupName(prev => !prev);
      }, DISPLAY_INTERVAL);

      return () => clearInterval(intervalId);
    }
    
    // Reset state when no circle is selected or modal is open
    setShowGroupName(true);
    nameOpacity.value = 1; 
    countOpacity.value = 0;
    
  }, [selectedCircle, isOpen]);

  // Effect for the actual fading animation
  useEffect(() => {
    if (selectedCircle && !isOpen) {
        if (showGroupName) {
            // Fade in Group Name (1), Fade out Count (0)
            nameOpacity.value = withTiming(1, { duration: TRANSITION_DURATION });
            countOpacity.value = withTiming(0, { duration: TRANSITION_DURATION });
        } else {
            // Fade out Group Name (0), Fade in Count (1)
            nameOpacity.value = withTiming(0, { duration: TRANSITION_DURATION });
            countOpacity.value = withTiming(1, { duration: TRANSITION_DURATION });
        }
    }
  }, [showGroupName, selectedCircle, isOpen]);

  // --- Animated Styles ---
  const animatedNameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
  }));
  
  const animatedCountStyle = useAnimatedStyle(() => ({
    opacity: countOpacity.value,
    // CRITICAL: Position absolutely over the name text to prevent layout jump
    position: 'absolute', 
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center', 
    // Match the vertical alignment of the main text style
    lineHeight: 20, 
  }));

  // Helper function to get the base text
  const getDropdownText = (isCount: boolean) => {
    if (!selectedCircle) {
      return 'Select Circle';
    }
    return isCount ? `1 Group Listening` : selectedCircle.name;
  };


  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleDropdown} style={styles.dropdownButton}>
        
        {/* --- Dynamic Text Container --- */}
        <View style={styles.dropdownButtonTextContainer}>
          {selectedCircle ? (
            <>
              {/* Animated Text 1: Group Name */}
              <Animated.Text style={[styles.dropdownButtonText, animatedNameStyle]}>
                {selectedCircle.name}
              </Animated.Text>
              
              {/* Animated Text 2: Group Count (positioned absolutely over Text 1) */}
              <Animated.Text style={[styles.dropdownButtonText, animatedCountStyle]}>
                1 Group Listening
              </Animated.Text>
            </>
          ) : (
            // Static text when no circle is selected
            <Text style={styles.dropdownButtonText}>Select Circle</Text>
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
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.dropdownItem} 
                      onPress={() => {
                        // The logic here is correct for single-select: select and close
                        onSelectCircle(item);
                        toggleDropdown();
                      }}
                    >
                      <View style={styles.dropdownItemContent}>
                        <View>
                          <Text style={styles.dropdownItemText}>{item.name}</Text>
                        </View>
                        {/* Checkmark logic is correct for single-select */}
                        {selectedCircle?.id === item.id && (
                          <Ionicons name="checkmark" size={24} color="#26D0CE" />
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
                
                {/* --- LEAVE BUTTON: Wrapped in container for correct width --- */}
                {selectedCircle && (
                  <View style={styles.leaveButtonContainer}>
                    <TouchableOpacity 
                      style={styles.leaveButton} 
                      onPress={() => {
                        onLeaveCircle(selectedCircle);
                        toggleDropdown();
                      }}
                    >
                      <Text style={styles.leaveButtonText}>
                          {`Leave ${selectedCircle.name}`}
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
  // --- NEW CONTAINER FOR ANIMATED TEXT ---
  dropdownButtonTextContainer: {
    flex: 1, // Takes up space to the left of the icon
    alignItems: 'center',
    justifyContent: 'center',
    // Must specify a height to prevent the button from collapsing during transition
    height: 20, 
  },
  dropdownButtonText: { 
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20, // Explicitly set line height to match container height
  },
  dropdownItemText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500', // Added a medium weight for clarity
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
    marginTop: 8,
    marginBottom: 4,
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});