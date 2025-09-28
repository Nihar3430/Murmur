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

interface JoinCircleModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
}

export default function JoinCircleModal({ visible, onClose, onJoin }: JoinCircleModalProps) {
  const [inviteCode, setInviteCode] = useState('');

  const handleJoin = () => {
    if (inviteCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit invite code');
      return;
    }
    onJoin(inviteCode);
    setInviteCode('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Join Circle</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit invite code"
            placeholderTextColor="#666"
            value={inviteCode}
            onChangeText={setInviteCode}
            maxLength={6}
            keyboardType="number-pad"
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
              <Text style={styles.buttonText}>Join</Text>
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
    letterSpacing: 2,
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
  joinButton: {
    backgroundColor: '#787878ff',
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