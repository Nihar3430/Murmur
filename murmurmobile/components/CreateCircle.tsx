import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert 
} from 'react-native';

interface CreateCircleModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void; 
}

export default function CreateCircleModal({ visible, onClose, onCreate }: CreateCircleModalProps) {
  const [circleName, setCircleName] = useState('');

  const handleCreate = () => {
    if (!circleName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a name for your circle.');
      return;
    }
    onCreate(circleName.trim());
    
    setCircleName('');
  };

  const handleClose = () => {
    setCircleName('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Create New Circle</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter circle name (e.g., Family, Friends)"
            placeholderTextColor="#666"
            value={circleName}
            onChangeText={setCircleName}
            maxLength={30}
            autoCapitalize="words"
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
    padding: 20,
    width: '80%',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 18,
    padding: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginRight: 10,
  },
  
  createButton: { 
    backgroundColor: '#26D0CE', 
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginLeft: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});