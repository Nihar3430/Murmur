import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  onSelectCircle: (circle: Circle) => void;
}

export default function CirclesDropdown({ circles, onJoinCircle, selectedCircle, onSelectCircle }: CirclesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleDropdown = () => setIsOpen(!isOpen);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleDropdown} style={styles.dropdownButton}>
        <Text style={styles.dropdownButtonText}>
          {selectedCircle ? selectedCircle.name : 'Join Circle'}
        </Text>
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
              <FlatList<Circle>
                data={circles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => {
                    onSelectCircle(item);
                    toggleDropdown();
                  }}>
                    <View style={styles.dropdownItemContent}>
                      <View>
                        <Text style={styles.dropdownItemText}>{item.name}</Text>
                      </View>
                      {selectedCircle?.id === item.id && (
                        <Ionicons name="checkmark" size={24} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : null}
            <TouchableOpacity 
              style={styles.joinButton} 
              onPress={() => {
                onJoinCircle();
                toggleDropdown();
              }}
            >
              <Text style={styles.joinButtonText}>Join Circle</Text>
            </TouchableOpacity>
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
    width: '70%',
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
  dropdownButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  joinButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(91, 91, 91, 0.9)',
    borderRadius: 8,
    marginTop: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});