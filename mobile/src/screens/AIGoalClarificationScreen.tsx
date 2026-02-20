import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { goalsApi, Clarification, EvaluatedCriteria, EvaluationQuestion } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AIGoalClarification'>;
  route: RouteProp<RootStackParamList, 'AIGoalClarification'>;
};

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  question?: EvaluationQuestion;
  isThinking?: boolean;
}

const AIGoalClarificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { goalData } = route.params;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [evaluatedCriteria, setEvaluatedCriteria] = useState<EvaluatedCriteria | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<EvaluationQuestion | null>(null);
  const [creatingGoal, setCreatingGoal] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const messageIdCounter = useRef(0);

  // Start evaluation when screen loads
  useEffect(() => {
    startEvaluation();
  }, []);

  // Animate new messages
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [messages]);

  const addMessage = (message: Omit<Message, 'id'>) => {
    messageIdCounter.current += 1;
    const newMessage = { ...message, id: `msg-${Date.now()}-${messageIdCounter.current}` };
    setMessages(prev => [...prev, newMessage]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const updateLastMessage = (updates: Partial<Message>) => {
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages.length > 0) {
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          ...updates,
        };
      }
      return newMessages;
    });
  };

  const startEvaluation = async () => {
    setLoading(true);
    
    // Add initial thinking message
    addMessage({
      type: 'ai',
      content: 'Analyzing your goal...',
      isThinking: true,
    });

    try {
      const result = await goalsApi.evaluate({
        title: goalData.title,
        description: goalData.description,
        verificationCriteria: goalData.verificationCriteria,
        previousClarifications: [],
      });

      // Remove thinking message and add actual response
      setMessages([]);
      
      if (result.status === 'needs_clarification' && result.question) {
        addMessage({
          type: 'ai',
          content: result.question.text,
          question: result.question,
        });
        setCurrentQuestion(result.question);
        setClarifications(result.clarifications || []);
      } else if (result.status === 'ready') {
        // AI has all the information
        handleReadyState(result);
      }
    } catch (error) {
      updateLastMessage({
        content: 'I had trouble analyzing your goal. Let me try a simplified evaluation.',
        isThinking: false,
      });
      
      // Fall back to ready state
      setTimeout(() => {
        setIsReady(true);
        addMessage({
          type: 'ai',
          content: "I have got all details about the goal. You can proceed with creating it.",
        });
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleReadyState = (result: any) => {
    setClarifications(result.clarifications || []);
    setEvaluatedCriteria(result.evaluatedCriteria || null);
    setIsReady(true);
    setCurrentQuestion(null);

    addMessage({
      type: 'ai',
      content: "I have got all details about the goal",
    });
  };

  const handleOptionSelect = async (option: { id: string; label: string }) => {
    if (!currentQuestion) return;

    // Add user's answer to chat
    addMessage({
      type: 'user',
      content: option.label,
    });

    // Add thinking message
    addMessage({
      type: 'ai',
      content: 'Processing your response...',
      isThinking: true,
    });

    setCurrentQuestion(null);
    setLoading(true);

    try {
      const result = await goalsApi.evaluate({
        title: goalData.title,
        description: goalData.description,
        verificationCriteria: goalData.verificationCriteria,
        previousClarifications: clarifications,
        latestAnswer: {
          question: currentQuestion.text,
          answer: option.label,
        },
      });

      // Remove thinking message
      setMessages(prev => prev.slice(0, -1));

      if (result.status === 'needs_clarification' && result.question) {
        addMessage({
          type: 'ai',
          content: result.question.text,
          question: result.question,
        });
        setCurrentQuestion(result.question);
        setClarifications(result.clarifications || []);
      } else if (result.status === 'ready') {
        handleReadyState(result);
      }
    } catch (error) {
      // Remove thinking message and show error
      setMessages(prev => prev.slice(0, -1));
      addMessage({
        type: 'ai',
        content: "I've gathered enough information. Let's proceed with your goal.",
      });
      setIsReady(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async () => {
    setCreatingGoal(true);

    try {
      const result = await goalsApi.create({
        ...goalData,
        clarifications,
        evaluatedCriteria: evaluatedCriteria || undefined,
      });

      const isGiftGoal = result.needsAcceptance;
      const isRecurringGoal = result.totalGoals && result.totalGoals > 1;
      const isGroupGoal = goalData.goalType === 'group';

      Alert.alert(
        isGroupGoal ? 'Group Goal Created! 👥' : (isRecurringGoal ? 'Recurring Goals Created! 🔄' : (isGiftGoal ? 'Goal Created! 🎁' : 'Goal Created! 🎯')),
        isGroupGoal
          ? `Group "${goalData.groupName}" has been created! Share the link with friends to invite them to join.`
          : (isRecurringGoal
            ? `${result.totalGoals} recurring goals have been created. The first goal is now active.`
            : (isGiftGoal
              ? `Your goal "${result.goal.title}" has been created. Share the link with ${goalData.seekerEmail || 'the goal seeker'} so they can accept it!`
              : `Your goal "${result.goal.title}" has been created. Share it with friends to get them to join!`)),
        [
          {
            text: 'View Goal',
            onPress: () => {
              if (isGroupGoal && result.groupGoal) {
                navigation.replace('GoalDetail', { goalId: result.goal._id, groupGoalId: result.groupGoal._id });
              } else {
                navigation.replace('GoalDetail', { goalId: result.goal._id });
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create goal'
      );
    } finally {
      setCreatingGoal(false);
    }
  };

  const renderMessage = (message: Message, index: number) => {
    const isAI = message.type === 'ai';

    return (
      <Animated.View
        key={message.id}
        style={[
          styles.messageContainer,
          isAI ? styles.aiMessageContainer : styles.userMessageContainer,
          { opacity: fadeAnim },
        ]}
      >
        {isAI && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>🤖</Text>
          </View>
        )}
        
        <View style={[styles.messageBubble, isAI ? styles.aiBubble : styles.userBubble]}>
          {message.isThinking ? (
            <View style={styles.thinkingContainer}>
              <ActivityIndicator size="small" color="#A5B4FC" />
              <Text style={styles.thinkingText}>{message.content}</Text>
            </View>
          ) : (
            <Text style={[styles.messageText, isAI ? styles.aiText : styles.userText]}>
              {message.content}
            </Text>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderQuestionOptions = () => {
    if (!currentQuestion || loading) return null;

    return (
      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((option, index) => (
          <TouchableOpacity
            key={option.id}
            style={styles.optionButton}
            onPress={() => handleOptionSelect(option)}
            activeOpacity={0.7}
          >
            <View style={styles.optionLetter}>
              <Text style={styles.optionLetterText}>
                {String.fromCharCode(65 + index)}
              </Text>
            </View>
            <Text style={styles.optionText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderSummary = () => {
    if (!isReady) return null;

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Goal Summary</Text>
        
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Title</Text>
            <Text style={styles.summaryValue}>{goalData.title}</Text>
          </View>
          
          {goalData.description && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Description</Text>
              <Text style={styles.summaryValue}>{goalData.description}</Text>
            </View>
          )}
          
          {goalData.verificationCriteria && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Verification</Text>
              <Text style={styles.summaryValue}>{goalData.verificationCriteria}</Text>
            </View>
          )}

          {clarifications.length > 0 && (
            <View style={styles.clarificationsSection}>
              <Text style={styles.clarificationsTitle}>Clarifications</Text>
              {clarifications.map((c, index) => (
                <View key={index} style={styles.clarificationItem}>
                  <Text style={styles.clarificationQuestion}>Q: {c.question}</Text>
                  <Text style={styles.clarificationAnswer}>A: {c.answer}</Text>
                </View>
              ))}
            </View>
          )}

          {evaluatedCriteria && (
            <View style={styles.criteriaSection}>
              <Text style={styles.criteriaTitle}>Evaluated Criteria</Text>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>🎯 Key KPI</Text>
                <Text style={styles.criteriaValue}>{evaluatedCriteria.keyKPI}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>📍 Current Status</Text>
                <Text style={styles.criteriaValue}>{evaluatedCriteria.currentStatus}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>🏁 Target KPI</Text>
                <Text style={styles.criteriaValue}>{evaluatedCriteria.targetKPI}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>📊 Progress Measurement</Text>
                <Text style={styles.criteriaValue}>{evaluatedCriteria.progressMeasurement}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>✅ Success Criteria</Text>
                <Text style={styles.criteriaValue}>{evaluatedCriteria.successCriteria}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>❌ Failure Criteria</Text>
                <Text style={styles.criteriaValue}>{evaluatedCriteria.failureCriteria}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>📸 Proof Method</Text>
                <Text style={styles.criteriaValue}>{evaluatedCriteria.proofMethod}</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.createButton, creatingGoal && styles.createButtonDisabled]}
          onPress={handleCreateGoal}
          disabled={creatingGoal}
        >
          {creatingGoal ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Confirm & Create Goal</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Goal Assistant</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeIcon}>🤖</Text>
          <Text style={styles.welcomeTitle}>Goal Evaluation</Text>
          <Text style={styles.welcomeSubtitle}>
            I'll help ensure your goal is clear and measurable
          </Text>
        </View>

        {/* Messages */}
        {messages.map((message, index) => renderMessage(message, index))}

        {/* Question options */}
        {renderQuestionOptions()}

        {/* Summary when ready */}
        {renderSummary()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
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
  },
  backButtonText: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 60,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 40,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  welcomeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  welcomeTitle: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  aiBubble: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#6366F1',
    marginLeft: 'auto',
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  aiText: {
    color: '#F9FAFB',
  },
  userText: {
    color: '#FFFFFF',
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingText: {
    color: '#A5B4FC',
    fontSize: 15,
    marginLeft: 10,
    fontStyle: 'italic',
  },
  optionsContainer: {
    marginTop: 8,
    marginBottom: 16,
    marginLeft: 46,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLetterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  optionText: {
    color: '#F9FAFB',
    fontSize: 15,
    flex: 1,
  },
  summaryContainer: {
    marginTop: 24,
  },
  summaryTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 15,
    lineHeight: 22,
  },
  clarificationsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  clarificationsTitle: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  clarificationItem: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  clarificationQuestion: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 4,
  },
  clarificationAnswer: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  criteriaSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  criteriaTitle: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  criteriaItem: {
    marginBottom: 12,
  },
  criteriaLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  criteriaValue: {
    color: '#F9FAFB',
    fontSize: 14,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default AIGoalClarificationScreen;

