import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';

export type InputMode = 'text' | 'image' | 'attachment';

interface Attachment {
  type: 'image' | 'document' | 'link';
  url: string;
  name?: string;
  mimeType?: string;
}

interface ChatInputBarProps {
  onSendText: (text: string) => void;
  onSendImage: (imageUri: string) => void;
  onSendTextWithAttachments: (text: string, attachments: Attachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  canSubmitVerification?: boolean;
  isParticipant?: boolean;
  isArchiveMode?: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendText,
  onSendImage,
  onSendTextWithAttachments,
  disabled = false,
  placeholder = 'Type a message...',
  canSubmitVerification = true,
  isParticipant = false,
  isArchiveMode = false,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  
  const slideAnim = useRef(new Animated.Value(0)).current;

  const toggleOptions = () => {
    setShowOptions(!showOptions);
    Animated.spring(slideAnim, {
      toValue: showOptions ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
      return false;
    }
    return true;
  };

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photos.');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setInputMode('image');
      setShowOptions(false);
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setInputMode('image');
      setShowOptions(false);
    }
  };

  const addAttachment = async () => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const newAttachment: Attachment = {
        type: 'image',
        url: asset.uri,
        name: asset.fileName || 'attachment',
        mimeType: asset.mimeType,
      };
      setAttachments([...attachments, newAttachment]);
      setInputMode('attachment');
      setShowOptions(false);
    }
  };

  const addLinkAttachment = () => {
    Alert.prompt(
      'Add Link',
      'Enter a URL to attach',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (url) => {
            if (url && url.trim()) {
              const newAttachment: Attachment = {
                type: 'link',
                url: url.trim(),
                name: url.trim(),
              };
              setAttachments([...attachments, newAttachment]);
              setInputMode('attachment');
            }
          },
        },
      ],
      'plain-text',
      '',
      'url'
    );
    setShowOptions(false);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setInputMode('text');
  };

  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
    if (newAttachments.length === 0) {
      setInputMode('text');
    }
  };

  const handleSend = () => {
    if (disabled) return;

    if (selectedImage) {
      onSendImage(selectedImage);
      setSelectedImage(null);
      setText('');
      setInputMode('text');
    } else if (attachments.length > 0) {
      onSendTextWithAttachments(text.trim(), attachments);
      setAttachments([]);
      setText('');
      setInputMode('text');
    } else if (text.trim()) {
      onSendText(text.trim());
      setText('');
    }
  };

  const canSend = (selectedImage || text.trim() || attachments.length > 0) && !disabled;

  // Determine the appropriate placeholder based on mode
  const getPlaceholderText = () => {
    if (isArchiveMode) {
      return 'Add a comment...';
    }
    if (isParticipant) {
      return 'Add a comment (AI won\'t respond)...';
    }
    return placeholder;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Selected image preview */}
      {selectedImage && (
        <View style={styles.previewContainer}>
          <View style={styles.previewCard}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity style={styles.removePreviewButton} onPress={clearImage}>
              <Text style={styles.removePreviewText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.previewLabel}>Ready to submit as verification</Text>
        </View>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <View style={styles.attachmentsPreview}>
          {attachments.map((att, index) => (
            <View key={index} style={styles.attachmentPreviewItem}>
              <Text style={styles.attachmentPreviewIcon}>
                {att.type === 'image' ? '🖼️' : att.type === 'link' ? '🔗' : '📄'}
              </Text>
              <Text style={styles.attachmentPreviewName} numberOfLines={1}>
                {att.name || att.url}
              </Text>
              <TouchableOpacity onPress={() => removeAttachment(index)}>
                <Text style={styles.removeAttachmentText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Options panel */}
      {showOptions && canSubmitVerification && (
        <Animated.View 
          style={[
            styles.optionsPanel,
            {
              opacity: slideAnim,
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              }],
            },
          ]}
        >
          <TouchableOpacity style={styles.optionButton} onPress={takePhoto}>
            <View style={[styles.optionIcon, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.optionIconText}>📷</Text>
            </View>
            <Text style={styles.optionLabel}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton} onPress={pickImage}>
            <View style={[styles.optionIcon, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.optionIconText}>🖼️</Text>
            </View>
            <Text style={styles.optionLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton} onPress={addAttachment}>
            <View style={[styles.optionIcon, { backgroundColor: theme.colors.secondary }]}>
              <Text style={styles.optionIconText}>📎</Text>
            </View>
            <Text style={styles.optionLabel}>Attach</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton} onPress={addLinkAttachment}>
            <View style={[styles.optionIcon, { backgroundColor: '#EC4899' }]}>
              <Text style={styles.optionIconText}>🔗</Text>
            </View>
            <Text style={styles.optionLabel}>Link</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Input bar */}
      <View style={styles.inputContainer}>
        {/* Plus button for options (only for verification submitters) */}
        {canSubmitVerification && (
          <TouchableOpacity
            style={[styles.optionsButton, showOptions && styles.optionsButtonActive]}
            onPress={toggleOptions}
            disabled={disabled}
          >
            <Text style={[styles.optionsButtonText, showOptions && styles.optionsButtonTextActive]}>
              {showOptions ? '✕' : '+'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Text input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder={getPlaceholderText()}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={1000}
            editable={!disabled}
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Text style={[styles.sendButtonText, canSend && styles.sendButtonTextActive]}>
            {selectedImage ? '📤' : '➤'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hint text for archive mode or participants */}
      {isArchiveMode && (
        <Text style={styles.participantHint}>
          Goal has ended. You can add comments and reactions, but the AI won't respond.
        </Text>
      )}
      {!isArchiveMode && isParticipant && !canSubmitVerification && (
        <Text style={styles.participantHint}>
          As a supporter, you can react and comment. The AI won't respond to comments.
        </Text>
      )}
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  optionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  optionsButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  optionsButtonText: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    fontWeight: '300',
  },
  optionsButtonTextActive: {
    color: '#FFFFFF',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 120,
  },
  textInput: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    maxHeight: 100,
    minHeight: 24,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  sendButtonText: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
  sendButtonTextActive: {
    color: '#FFFFFF',
  },
  // Options panel
  optionsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  optionButton: {
    alignItems: 'center',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionIconText: {
    fontSize: 24,
  },
  optionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  // Preview styles
  previewContainer: {
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  previewCard: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: 120,
    height: 90,
    borderRadius: 12,
  },
  removePreviewButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePreviewText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  previewLabel: {
    color: theme.colors.success,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginTop: 8,
  },
  // Attachments preview
  attachmentsPreview: {
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 8,
  },
  attachmentPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachmentPreviewIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  attachmentPreviewName: {
    color: theme.isDark ? '#D1D5DB' : theme.colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  removeAttachmentText: {
    color: theme.colors.danger,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  // Participant hint
  participantHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
  },
});

export default ChatInputBar;
