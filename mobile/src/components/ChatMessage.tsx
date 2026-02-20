import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';
import { ReactionPicker } from './ReactionPicker';
import { VerificationResultBadge, VerificationStatus } from './VerificationResultBadge';

interface MessageContent {
  text?: string;
  imageUrl?: string;
  attachments?: Array<{
    type: 'image' | 'document' | 'link';
    url: string;
    name?: string;
  }>;
  verificationId?: string;
}

interface AIResult {
  status: VerificationStatus;
  reasoning: string;
  confidence?: number;
}

interface Reaction {
  _id: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    name: string;
    profileImage?: string;
  };
}

interface Sender {
  _id: string;
  name: string;
  email?: string;
  profileImage?: string;
}

export interface ChatMessageData {
  _id: string;
  type: 'system' | 'verification' | 'ai_response' | 'participant_comment';
  senderId?: Sender;
  content: MessageContent;
  aiResult?: AIResult;
  reactions: Reaction[];
  createdAt: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onImagePress?: (imageUrl: string) => void;
  isParticipant?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  currentUserId,
  onReact,
  onImagePress,
  isParticipant = false,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const isOwnMessage = message.senderId?._id === currentUserId;
  const isAI = message.type === 'ai_response';
  const isSystem = message.type === 'system';
  const isVerification = message.type === 'verification';
  const isComment = message.type === 'participant_comment';

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render system message
  if (isSystem) {
    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.systemMessageBubble}>
          <Text style={styles.systemMessageText}>{message.content.text}</Text>
        </View>
        <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
      </View>
    );
  }

  // Render AI response
  if (isAI) {
    return (
      <View style={styles.aiMessageContainer}>
        <View style={styles.aiHeader}>
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🤖</Text>
          </View>
          <Text style={styles.aiName}>Goal Assistant</Text>
          <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
        </View>
        
        <View style={styles.aiBubble}>
          {message.aiResult && (
            <VerificationResultBadge 
              status={message.aiResult.status}
              confidence={message.aiResult.confidence}
            />
          )}
          <Text style={styles.aiText}>{message.content.text}</Text>
        </View>

        <ReactionPicker
          reactions={message.reactions || []}
          currentUserId={currentUserId}
          onReact={(emoji) => onReact(message._id, emoji)}
        />
      </View>
    );
  }

  // Render verification submission or comment
  const senderName = message.senderId?.name || 'Unknown';
  const senderInitial = senderName.charAt(0).toUpperCase();

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
    ]}>
      {/* Avatar for other users' messages */}
      {!isOwnMessage && (
        <View style={[styles.avatar, isComment && styles.commentAvatar]}>
          {message.senderId?.profileImage ? (
            <Image
              source={{ uri: message.senderId.profileImage }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>{senderInitial}</Text>
          )}
        </View>
      )}

      <View style={[
        styles.messageContent,
        isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent,
      ]}>
        {/* Sender name for other users */}
        {!isOwnMessage && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        {/* Message bubble */}
        <View style={[
          styles.bubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble,
          isVerification && styles.verificationBubble,
          isComment && styles.commentBubble,
        ]}>
          {/* Verification label */}
          {isVerification && (
            <View style={styles.verificationLabel}>
              <Text style={styles.verificationLabelText}>📸 Verification</Text>
            </View>
          )}

          {/* Comment label */}
          {isComment && (
            <View style={styles.commentLabel}>
              <Text style={styles.commentLabelText}>💬 Comment</Text>
            </View>
          )}

          {/* Image content */}
          {message.content.imageUrl && (
            <TouchableOpacity
              onPress={() => onImagePress?.(message.content.imageUrl!)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: message.content.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {/* Text content */}
          {message.content.text && (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}>
              {message.content.text}
            </Text>
          )}

          {/* Attachments */}
          {message.content.attachments && message.content.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {message.content.attachments.map((attachment, index) => (
                <View key={index} style={styles.attachment}>
                  <Text style={styles.attachmentIcon}>
                    {attachment.type === 'image' ? '🖼️' : 
                     attachment.type === 'link' ? '🔗' : '📄'}
                  </Text>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachment.name || attachment.url}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Timestamp */}
        <Text style={[
          styles.messageTimestamp,
          isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
        ]}>
          {formatTime(message.createdAt)}
        </Text>

        {/* Reactions */}
        <ReactionPicker
          reactions={message.reactions || []}
          currentUserId={currentUserId}
          onReact={(emoji) => onReact(message._id, emoji)}
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  // System message styles
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  systemMessageBubble: {
    backgroundColor: theme.colors.infoBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '90%',
  },
  systemMessageText: {
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },

  // AI message styles
  aiMessageContainer: {
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  aiAvatarText: {
    fontSize: 16,
  },
  aiName: {
    color: theme.isDark ? '#A5B4FC' : theme.colors.primary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    flex: 1,
  },
  aiBubble: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: 40,
  },
  aiText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },

  // Message container styles
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },

  // Avatar styles
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  commentAvatar: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },

  // Message content styles
  messageContent: {
    maxWidth: '75%',
  },
  ownMessageContent: {
    alignItems: 'flex-end',
  },
  otherMessageContent: {
    alignItems: 'flex-start',
  },
  senderName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },

  // Bubble styles
  bubble: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ownBubble: {
    backgroundColor: theme.colors.primary,
    borderTopRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  verificationBubble: {
    borderColor: theme.colors.success,
    borderWidth: 1,
  },
  commentBubble: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
  },

  // Labels
  verificationLabel: {
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verificationLabelText: {
    color: theme.isDark ? '#6EE7B7' : theme.colors.success,
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
  commentLabel: {
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  commentLabelText: {
    color: theme.isDark ? '#D1D5DB' : theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },

  // Image styles
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 0,
  },

  // Text styles
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
    padding: 12,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: theme.colors.textPrimary,
  },

  // Attachments
  attachmentsContainer: {
    padding: 12,
    paddingTop: 0,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  attachmentIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  attachmentName: {
    color: theme.isDark ? '#D1D5DB' : theme.colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },

  // Timestamp styles
  timestamp: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  messageTimestamp: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  ownTimestamp: {
    textAlign: 'right',
  },
  otherTimestamp: {
    textAlign: 'left',
  },
});

export default ChatMessage;
