import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Goal } from '../types';
import { verificationApi, goalsApi } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { ChatMessage, ChatMessageData } from '../components/ChatMessage';
import { ChatInputBar } from '../components/ChatInputBar';
import { formatCentsToDollars, getDeadlineStatus } from '../utils/formatters';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VerificationChat'>;
  route: RouteProp<RootStackParamList, 'VerificationChat'>;
};

interface ChatData {
  _id: string;
  goalId: string;
  messages: ChatMessageData[];
  initialSummary: {
    title: string;
    objective?: string;
    verificationMethod?: string;
    clarifications?: Array<{ question: string; answer: string }>;
    evaluatedCriteria?: {
      keyKPI?: string;
      currentStatus?: string;
      targetKPI?: string;
      progressMeasurement?: string;
      successCriteria?: string;
      failureCriteria?: string;
      proofMethod?: string;
    };
  };
  completionConfirmed: boolean;
  completionConfirmedAt?: string;
}

interface GoalInfo {
  _id: string;
  title: string;
  status: string;
  deadline: string;
  goalType?: string;
  totalPot?: number;
}

const VerificationChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const { goalId } = route.params;
  const { user } = useAuth();
  
  const [chat, setChat] = useState<ChatData | null>(null);
  const [goal, setGoal] = useState<GoalInfo | null>(null);
  const [userRole, setUserRole] = useState<'seeker' | 'participant'>('participant');
  const [canSubmitVerification, setCanSubmitVerification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canConfirmCompletion, setCanConfirmCompletion] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);

  const loadChatData = useCallback(async () => {
    try {
      const result = await verificationApi.getChatHistory(goalId);
      setChat(result.chat);
      setGoal(result.goal);
      setUserRole(result.userRole);
      setCanSubmitVerification(result.canSubmitVerification);
      
      // Check if user can confirm completion
      const lastAIMessage = result.chat.messages
        .filter((m: ChatMessageData) => m.type === 'ai_response')
        .pop();
      
      if (lastAIMessage?.aiResult?.status === 'completed' && !result.chat.completionConfirmed) {
        setCanConfirmCompletion(true);
      } else {
        setCanConfirmCompletion(false);
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
      Alert.alert('Error', 'Failed to load verification chat');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [goalId]);

  useEffect(() => {
    loadChatData();
  }, [loadChatData]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (chat?.messages.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chat?.messages.length]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadChatData();
  };

  const handleSendText = async (text: string) => {
    if (!user) return;
    
    // In archive mode (goal finished), always submit as comment - AI won't respond
    const goalFinished = goal?.status === 'completed' || goal?.status === 'failed';
    const shouldSubmitAsVerification = canSubmitVerification && !goalFinished;
    
    if (shouldSubmitAsVerification) {
      // Submit as verification with text
      setSubmitting(true);
      try {
        const result = await verificationApi.submitTextVerification(goalId, text, []);
        
        if (result.canConfirmCompletion) {
          setCanConfirmCompletion(true);
        }
        
        await loadChatData();
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit verification');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Submit as comment (participant or archive mode)
      try {
        await verificationApi.addComment(goalId, text);
        await loadChatData();
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add comment');
      }
    }
  };

  const handleSendImage = async (imageUri: string) => {
    if (!user || !canSubmitVerification) return;
    
    setSubmitting(true);
    try {
      const result = await verificationApi.submit(goalId, imageUri);
      
      if (result.canConfirmCompletion) {
        setCanConfirmCompletion(true);
      }
      
      await loadChatData();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendTextWithAttachments = async (text: string, attachments: Array<{ type: 'image' | 'document' | 'link'; url: string; name?: string }>) => {
    if (!user || !canSubmitVerification) return;
    
    setSubmitting(true);
    try {
      const result = await verificationApi.submitTextVerification(goalId, text, attachments);
      
      if (result.canConfirmCompletion) {
        setCanConfirmCompletion(true);
      }
      
      await loadChatData();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await verificationApi.addReaction(goalId, messageId, emoji);
      await loadChatData();
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleImagePress = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const handleConfirmCompletion = async () => {
    Alert.alert(
      'Confirm Goal Completion',
      'Are you sure you want to confirm that you\'ve completed this goal? This action will finalize your goal and distribute any rewards.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Completion',
          style: 'default',
          onPress: async () => {
            try {
              const result = await verificationApi.confirmComplete(goalId);
              Alert.alert('Success', result.message);
              setCanConfirmCompletion(false);
              await loadChatData();
              
              // Navigate to goal detail if completed
              if (result.goalStatus === 'completed') {
                navigation.replace('GoalDetail', { goalId });
              }
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to confirm completion');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!chat || !goal) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Failed to load verification chat</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadChatData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isParticipant = userRole === 'participant';
  const isDeadlinePassed = new Date() > new Date(goal.deadline);
  const isGoalFinished = goal.status === 'completed' || goal.status === 'failed';
  
  // In archive mode, no one can submit verifications - only comments allowed
  const effectiveCanSubmitVerification = canSubmitVerification && !isGoalFinished;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{goal.title}</Text>
          <Text style={[
            styles.headerDeadline,
            isDeadlinePassed && styles.deadlinePassed
          ]}>
            {isDeadlinePassed ? '⏰ Deadline passed' : `⏳ ${getDeadlineStatus(goal.deadline)}`}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Archive mode banner for finished goals */}
      {isGoalFinished && (
        <View style={[styles.archiveBanner, goal.status === 'completed' ? styles.archiveBannerCompleted : styles.archiveBannerFailed]}>
          <Text style={styles.archiveBannerIcon}>
            {goal.status === 'completed' ? '🏆' : '📋'}
          </Text>
          <View style={styles.archiveBannerTextContainer}>
            <Text style={[styles.archiveBannerTitle, goal.status === 'completed' ? styles.archiveBannerTitleCompleted : styles.archiveBannerTitleFailed]}>
              {goal.status === 'completed' ? 'Goal Completed' : 'Goal Ended'}
            </Text>
            <Text style={styles.archiveBannerSubtitle}>
              Viewing history - comments & reactions only
            </Text>
          </View>
        </View>
      )}

      {/* Confirm completion banner */}
      {canConfirmCompletion && !isParticipant && !isGoalFinished && (
        <TouchableOpacity style={styles.completionBanner} onPress={handleConfirmCompletion}>
          <Text style={styles.completionBannerText}>🎉 Goal completed! Tap to confirm</Text>
        </TouchableOpacity>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* Welcome header */}
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeIconContainer}>
            <Text style={styles.welcomeIcon}>🤖</Text>
          </View>
          <Text style={styles.welcomeTitle}>Verification Assistant</Text>
          <Text style={styles.welcomeSubtitle}>
            {isGoalFinished
              ? 'This goal has ended. Browse the verification history below.\nYou can still add comments and reactions.'
              : effectiveCanSubmitVerification 
                ? 'Submit your progress updates and I\'ll help verify your goal!'
                : 'Follow along and support the goal seeker!'
            }
          </Text>
        </View>

        {/* Messages */}
        {chat.messages.map((message) => (
          <ChatMessage
            key={message._id}
            message={message}
            currentUserId={user?._id || ''}
            onReact={handleReact}
            onImagePress={handleImagePress}
            isParticipant={isParticipant}
          />
        ))}

        {/* AI Thinking indicator */}
        {submitting && canSubmitVerification && (
          <View style={styles.thinkingContainer}>
            <View style={styles.thinkingHeader}>
              <View style={styles.thinkingAvatar}>
                <Text style={styles.thinkingAvatarText}>🤖</Text>
              </View>
              <Text style={styles.thinkingName}>Goal Assistant</Text>
            </View>
            <View style={styles.thinkingBubble}>
              <View style={styles.thinkingDots}>
                <ActivityIndicator size="small" color="#A5B4FC" />
                <Text style={styles.thinkingText}>Generating reply...</Text>
              </View>
            </View>
          </View>
        )}

        {/* Completion confirmed message */}
        {chat.completionConfirmed && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>🎊 Goal Completed & Confirmed!</Text>
          </View>
        )}

        {/* Deadline passed notice */}
        {isDeadlinePassed && !chat.completionConfirmed && (
          <View style={styles.deadlineNotice}>
            <Text style={styles.deadlineNoticeText}>
              The deadline has passed. No more verifications can be submitted.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input bar - show for active goals (before deadline) OR finished goals (archive mode) */}
      {((!isDeadlinePassed && !chat.completionConfirmed) || isGoalFinished) && (
        <ChatInputBar
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendTextWithAttachments={handleSendTextWithAttachments}
          disabled={submitting}
          canSubmitVerification={effectiveCanSubmitVerification}
          isParticipant={isParticipant || isGoalFinished}
          isArchiveMode={isGoalFinished}
          placeholder={isGoalFinished ? 'Add a comment...' : (effectiveCanSubmitVerification ? 'Describe your progress...' : 'Add a comment...')}
        />
      )}

      {/* Image preview modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setShowImageModal(false)}
          >
            <Text style={styles.imageModalCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    padding: 8,
    minWidth: 60,
  },
  backButtonText: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  headerDeadline: {
    color: '#FCD34D',
    fontSize: 12,
    marginTop: 2,
  },
  deadlinePassed: {
    color: '#EF4444',
  },
  headerSpacer: {
    minWidth: 60,
  },

  // Archive mode banner
  archiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  archiveBannerCompleted: {
    backgroundColor: '#1E3A5F',
  },
  archiveBannerFailed: {
    backgroundColor: '#3D2F2F',
  },
  archiveBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  archiveBannerTextContainer: {
    flex: 1,
  },
  archiveBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  archiveBannerTitleCompleted: {
    color: '#93C5FD',
  },
  archiveBannerTitleFailed: {
    color: '#FCA5A5',
  },
  archiveBannerSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },

  // Completion banner
  completionBanner: {
    backgroundColor: '#065F46',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  completionBannerText: {
    color: '#6EE7B7',
    fontSize: 14,
    fontWeight: '700',
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 20,
  },

  // Welcome
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  welcomeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#374151',
  },
  welcomeIcon: {
    fontSize: 32,
  },
  welcomeTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Completed badge
  completedBadge: {
    backgroundColor: '#065F46',
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completedBadgeText: {
    color: '#6EE7B7',
    fontSize: 16,
    fontWeight: '700',
  },

  // Deadline notice
  deadlineNotice: {
    backgroundColor: '#7F1D1D',
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deadlineNoticeText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
  },

  // Image modal
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  imageModalCloseText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  imageModalImage: {
    width: '90%',
    height: '70%',
  },

  // Thinking indicator
  thinkingContainer: {
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  thinkingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  thinkingAvatarText: {
    fontSize: 16,
  },
  thinkingName: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '600',
  },
  thinkingBubble: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginLeft: 40,
  },
  thinkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingText: {
    color: '#A5B4FC',
    fontSize: 14,
    marginLeft: 10,
    fontStyle: 'italic',
  },
});

export default VerificationChatScreen;

