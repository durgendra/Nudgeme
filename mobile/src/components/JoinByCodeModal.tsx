import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const JoinByCodeModal: React.FC<Props> = ({ visible, onClose, navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const code = shareCode.trim().toUpperCase();
    
    if (!code) {
      Alert.alert('Error', 'Please enter a share code');
      return;
    }

    if (code.length < 4) {
      Alert.alert('Error', 'Share code must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      // Navigate to JoinGoal screen with share code
      navigation.navigate('JoinGoal', { shareCode: code });
      setShareCode('');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to join goal. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShareCode('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Join Goal by Code</Text>
            <Text style={styles.subtitle}>
              Enter the 8-character share code to join a goal
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter share code (e.g., ABC12345)"
                placeholderTextColor={theme.colors.textMuted}
                value={shareCode}
                onChangeText={(text) => setShareCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                autoCapitalize="characters"
                maxLength={8}
                autoFocus
                editable={!loading}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.joinButton, (!shareCode.trim() || loading) && styles.joinButtonDisabled]}
                onPress={handleJoin}
                disabled={!shareCode.trim() || loading}
              >
                <Text style={styles.joinButtonText}>
                  {loading ? 'Joining...' : 'Join Goal'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.modal,
    padding: 24,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.cardElevated,
  },
  title: {
    fontSize: 24,
    fontFamily: theme.isDark ? 'Inter-Bold' : 'Inter-SemiBold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: theme.isDark ? theme.colors.background : theme.colors.surface,
    borderRadius: theme.borderRadius.input,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: theme.borderRadius.button,
    padding: 16,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  joinButton: {
    backgroundColor: theme.colors.primary,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
});

export default JoinByCodeModal;
