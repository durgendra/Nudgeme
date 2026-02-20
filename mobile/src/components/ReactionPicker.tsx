import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';

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

interface ReactionPickerProps {
  reactions: Reaction[];
  currentUserId: string;
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

// Organized emoji categories
const EMOJI_CATEGORIES = {
  'Reactions': ['👍', '❤️', '🎉', '👏', '💪', '🔥', '⭐', '✨', '💯', '🙌'],
  'Encouragement': ['💪', '🚀', '🌟', '👑', '🏆', '🥇', '💎', '🎯', '⚡', '🌈'],
  'Emotions': ['😊', '😄', '🥳', '😍', '🤩', '😎', '🥰', '😇', '🤗', '😮'],
  'Support': ['🤝', '👊', '✊', '🙏', '💝', '💖', '💗', '💓', '💕', '❣️'],
};

const QUICK_REACTIONS = ['👍', '❤️', '🎉', '👏', '💪', '🔥'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  reactions,
  currentUserId,
  onReact,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [showPicker, setShowPicker] = useState(false);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const handleReact = (emoji: string) => {
    if (!disabled) {
      onReact(emoji);
      setShowPicker(false);
    }
  };

  const hasUserReacted = (emoji: string) => {
    return reactions.some(r => r.emoji === emoji && r.userId === currentUserId);
  };

  return (
    <View style={styles.container}>
      {/* Existing reactions */}
      <View style={styles.reactionsRow}>
        {Object.entries(groupedReactions).map(([emoji, reactionList]) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionBubble,
              hasUserReacted(emoji) && styles.reactionBubbleActive,
            ]}
            onPress={() => handleReact(emoji)}
            disabled={disabled}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={[
              styles.reactionCount,
              hasUserReacted(emoji) && styles.reactionCountActive,
            ]}>
              {reactionList.length}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Add reaction button */}
        {!disabled && (
          <TouchableOpacity
            style={styles.addReactionButton}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.addReactionText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Emoji picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHandle} />
            
            {/* Quick reactions row */}
            <View style={styles.quickReactionsRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.quickReactionButton,
                    hasUserReacted(emoji) && styles.quickReactionButtonActive,
                  ]}
                  onPress={() => handleReact(emoji)}
                >
                  <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Full emoji grid */}
            <ScrollView 
              style={styles.emojiGrid}
              showsVerticalScrollIndicator={false}
            >
              {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <View style={styles.emojiRow}>
                    {emojis.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.emojiButton,
                          hasUserReacted(emoji) && styles.emojiButtonActive,
                        ]}
                        onPress={() => handleReact(emoji)}
                      >
                        <Text style={styles.emoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    marginTop: 8,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reactionBubbleActive: {
    backgroundColor: theme.colors.infoBg,
    borderColor: theme.colors.info,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 4,
    fontFamily: 'Inter-SemiBold',
  },
  reactionCountActive: {
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
  },
  addReactionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addReactionText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  quickReactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  quickReactionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickReactionButtonActive: {
    backgroundColor: theme.colors.infoBg,
    borderWidth: 2,
    borderColor: theme.colors.info,
  },
  quickReactionEmoji: {
    fontSize: 24,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  emojiGrid: {
    paddingHorizontal: 20,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiButtonActive: {
    backgroundColor: theme.colors.infoBg,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  emoji: {
    fontSize: 22,
  },
});

export default ReactionPicker;
