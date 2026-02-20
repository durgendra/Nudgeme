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
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { goalsApi } from '../services/api';
import { formatDate, formatCentsToDollars } from '../utils/formatters';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AIGoalCreation'>;
  route: RouteProp<RootStackParamList, 'AIGoalCreation'>;
};

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  question?: {
    id: string;
    text: string;
    options?: Array<{ id: string; label: string }>;
  };
  isThinking?: boolean;
}

interface EvaluatedCriteria {
  keyKPI?: string;
  currentStatus?: string;
  targetKPI?: string;
  progressMeasurement?: string;
  successCriteria?: string;
  failureCriteria?: string;
  proofMethod?: string;
}

interface CollectedData {
  goalType?: 'self' | 'gift' | 'group';
  title?: string;
  description?: string;
  startDate?: string;
  deadline?: string;
  seedAmount?: number;
  verificationCriteria?: string;
  seekerEmail?: string;
  groupName?: string;
  goalMode?: 'common' | 'individual';
  isRecurring?: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  recurrenceEndDate?: string;
  // AI evaluation data
  titleEvaluated?: boolean;
  evaluatedCriteria?: EvaluatedCriteria;
  clarifications?: Array<{ question: string; answer: string }>;
}

const AIGoalCreationScreen: React.FC<Props> = ({ navigation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string;
    text: string;
    options?: Array<{ id: string; label: string }>;
  } | null>(null);
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  const [conversationHistory, setConversationHistory] = useState<Array<{
    question: string;
    answer: string;
    answeredAt?: Date;
  }>>([]);
  const [creatingGoal, setCreatingGoal] = useState(false);
  
  // For free text inputs
  const [textInputValue, setTextInputValue] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'startDate' | 'deadline' | 'recurrenceEnd'>('startDate');
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const messageIdCounter = useRef(0);

  // Start conversation when screen loads
  useEffect(() => {
    startConversation();
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

  const startConversation = async () => {
    setLoading(true);
    
    // Add welcome message
    addMessage({
      type: 'ai',
      content: 'Hello! I\'m here to help you create a goal. Let me ask you a few questions to get started.',
    });

    try {
      const result = await goalsApi.assistCreate({
        conversationHistory: [],
        collectedData: {},
      });

      if (result.status === 'needs_info' && result.question) {
        addMessage({
          type: 'ai',
          content: result.question.text,
          question: result.question,
        });
        setCurrentQuestion(result.question);
        setCollectedData(result.collectedData || {});
      } else if (result.status === 'ready') {
        handleReadyState(result);
      }
    } catch (error) {
      addMessage({
        type: 'ai',
        content: 'I encountered an error. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReadyState = (result: any) => {
    const data = result.collectedData || {};
    // Store evaluated criteria if provided
    if (result.evaluatedCriteria) {
      data.evaluatedCriteria = result.evaluatedCriteria;
    }
    setCollectedData(data);
    setIsReady(true);
    setCurrentQuestion(null);
    setLoading(false);

    addMessage({
      type: 'ai',
      content: "Perfect! I have all the information I need. Let me show you a summary of your goal.",
    });
  };

  const handleOptionSelect = async (option: { id: string; label: string }) => {
    if (!currentQuestion) return;

    // Add user's answer to chat
    addMessage({
      type: 'user',
      content: option.label,
    });

    // Update conversation history
    const newHistory = [...conversationHistory, {
      question: currentQuestion.text,
      answer: option.label,
      answeredAt: new Date(),
    }];
    setConversationHistory(newHistory);

    // Process answer based on question type
    let processedAnswer = option.id;
    let updatedCollectedData = { ...collectedData };

    // Handle special cases
    if (currentQuestion.id === 'description' && option.id === 'no') {
      processedAnswer = 'no';
      updatedCollectedData.description = '';
    } else if (currentQuestion.id === 'verificationCriteria' && option.id === 'no') {
      processedAnswer = 'no';
      updatedCollectedData.verificationCriteria = '';
    } else if (currentQuestion.id === 'seekerEmail' && option.id === 'no') {
      processedAnswer = 'no';
      updatedCollectedData.seekerEmail = '';
    } else if (currentQuestion.id === 'startDate' && option.id === 'custom') {
      setDatePickerMode('startDate');
      setDatePickerValue(new Date());
      setShowDatePicker(true);
      return;
    } else if (currentQuestion.id === 'deadline' && option.id === 'custom') {
      setDatePickerMode('deadline');
      setDatePickerValue(new Date());
      setShowDatePicker(true);
      return;
    } else if (currentQuestion.id === 'recurrenceEndDate' && option.id === 'custom') {
      setDatePickerMode('recurrenceEnd');
      setDatePickerValue(new Date());
      setShowDatePicker(true);
      return;
    } else if (currentQuestion.id === 'seedAmount' && option.id === 'custom') {
      setShowTextInput(true);
      setTextInputValue('');
      return;
    } else if (currentQuestion.id === 'description' && option.id === 'yes') {
      setShowTextInput(true);
      setTextInputValue('');
      return;
    } else if (currentQuestion.id === 'verificationCriteria' && option.id === 'yes') {
      setShowTextInput(true);
      setTextInputValue('');
      return;
    } else if (currentQuestion.id === 'seekerEmail' && option.id === 'yes') {
      setShowTextInput(true);
      setTextInputValue('');
      return;
    } else if (currentQuestion.id === 'title_clarification' && option.id === 'other') {
      // User wants to provide a custom refined title
      setShowTextInput(true);
      setTextInputValue('');
      return;
    } else if (currentQuestion.id === 'title_clarification') {
      // User selected a suggested refinement for vague title
      processedAnswer = option.label;
    } else if (currentQuestion.id.startsWith('eval_') && option.id === 'other') {
      // User wants to provide custom answer to evaluation question
      setShowTextInput(true);
      setTextInputValue('');
      return;
    } else if (currentQuestion.id.startsWith('eval_')) {
      // User selected an option for evaluation clarification
      processedAnswer = option.label;
    }

    // Process the answer
    await processAnswer(processedAnswer, updatedCollectedData, newHistory);
  };

  const handleTextInputSubmit = async () => {
    if (!currentQuestion || !textInputValue.trim()) return;

    // Add user's answer to chat
    addMessage({
      type: 'user',
      content: textInputValue.trim(),
    });

    // Update conversation history
    const newHistory = [...conversationHistory, {
      question: currentQuestion.text,
      answer: textInputValue.trim(),
      answeredAt: new Date(),
    }];
    setConversationHistory(newHistory);

    let updatedCollectedData = { ...collectedData };
    let processedAnswer = textInputValue.trim();

    // Handle different input types
    if (currentQuestion.id === 'title') {
      updatedCollectedData.title = processedAnswer;
    } else if (currentQuestion.id === 'title_clarification') {
      // User provided custom text for title clarification
      // The backend will handle appending this to the title
      processedAnswer = processedAnswer;
    } else if (currentQuestion.id.startsWith('eval_')) {
      // User provided custom answer for evaluation question
      // This will be sent to the backend as-is
      processedAnswer = processedAnswer;
    } else if (currentQuestion.id === 'description') {
      updatedCollectedData.description = processedAnswer;
    } else if (currentQuestion.id === 'verificationCriteria') {
      updatedCollectedData.verificationCriteria = processedAnswer;
    } else if (currentQuestion.id === 'seekerEmail') {
      updatedCollectedData.seekerEmail = processedAnswer;
    } else if (currentQuestion.id === 'groupName') {
      updatedCollectedData.groupName = processedAnswer;
    } else if (currentQuestion.id === 'seedAmount') {
      const amount = parseFloat(processedAnswer);
      if (!isNaN(amount) && amount >= 1) {
        updatedCollectedData.seedAmount = Math.round(amount * 100); // Convert to cents
        processedAnswer = `$${amount}`;
        // Send with amount_ prefix for custom amounts
        setTextInputValue('');
        setShowTextInput(false);
        await processAnswerWithQuestionId('amount_custom', amount.toString(), updatedCollectedData, newHistory);
        return;
      }
    }

    setTextInputValue('');
    setShowTextInput(false);
    await processAnswer(processedAnswer, updatedCollectedData, newHistory);
  };

  const handleDatePickerChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      setDatePickerValue(selectedDate);
      
      if (Platform.OS === 'ios') {
        // On iOS, show picker in modal, user confirms separately
        return;
      }

      // On Android, date is selected immediately
      await processDateSelection(selectedDate);
    }
  };

  const handleDateConfirm = async () => {
    setShowDatePicker(false);
    await processDateSelection(datePickerValue);
  };

  const processDateSelection = async (selectedDate: Date) => {
    if (!currentQuestion) return;

    const dateStr = selectedDate.toISOString();
    const formattedDate = formatDate(dateStr);

    // Add user's answer to chat
    addMessage({
      type: 'user',
      content: formattedDate,
    });

    // Update conversation history
    const newHistory = [...conversationHistory, {
      question: currentQuestion.text,
      answer: formattedDate,
      answeredAt: new Date(),
    }];
    setConversationHistory(newHistory);

    let updatedCollectedData = { ...collectedData };

    // Determine the question ID to send based on date picker mode
    let questionIdToSend = currentQuestion.id;
    if (datePickerMode === 'startDate') {
      updatedCollectedData.startDate = dateStr;
      questionIdToSend = 'date_startDate';
    } else if (datePickerMode === 'deadline') {
      updatedCollectedData.deadline = dateStr;
      questionIdToSend = 'date_deadline';
    } else if (datePickerMode === 'recurrenceEnd') {
      updatedCollectedData.recurrenceEndDate = dateStr;
      questionIdToSend = 'date_recurrenceEndDate';
    }

    await processAnswerWithQuestionId(questionIdToSend, dateStr, updatedCollectedData, newHistory);
  };

  const processAnswer = async (answer: string, updatedCollectedData: CollectedData, newHistory: any[]) => {
    await processAnswerWithQuestionId(currentQuestion?.id || '', answer, updatedCollectedData, newHistory);
  };

  const processAnswerWithQuestionId = async (questionId: string, answer: string, updatedCollectedData: CollectedData, newHistory: any[]) => {
    setCurrentQuestion(null);
    setLoading(true);
    setCollectedData(updatedCollectedData);

    // Add thinking message
    addMessage({
      type: 'ai',
      content: 'Processing...',
      isThinking: true,
    });

    try {
      const result = await goalsApi.assistCreate({
        conversationHistory: newHistory,
        latestAnswer: {
          questionId: questionId,
          questionText: currentQuestion?.text || '',
          answer: answer,
        },
        collectedData: updatedCollectedData,
      });

      // Remove thinking message
      setMessages(prev => prev.slice(0, -1));

      if (result.status === 'needs_info' && result.question) {
        addMessage({
          type: 'ai',
          content: result.question.text,
          question: result.question,
        });
        setCurrentQuestion(result.question);
        setCollectedData(result.collectedData || updatedCollectedData);
      } else if (result.status === 'ready') {
        handleReadyState(result);
      }
    } catch (error) {
      // Remove thinking message
      setMessages(prev => prev.slice(0, -1));
      addMessage({
        type: 'ai',
        content: "I encountered an error. Let's continue.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async () => {
    setCreatingGoal(true);

    try {
      // Prepare goal data for creation
      const goalData: any = {
        title: collectedData.title || '',
        description: collectedData.description,
        startDate: collectedData.startDate || new Date().toISOString(),
        deadline: collectedData.deadline || '',
        seedAmount: collectedData.seedAmount || 100,
        verificationCriteria: collectedData.verificationCriteria,
        goalType: collectedData.goalType || 'self',
      };

      if (collectedData.goalType === 'gift' && collectedData.seekerEmail) {
        goalData.seekerEmail = collectedData.seekerEmail;
      }

      if (collectedData.goalType === 'group') {
        goalData.groupName = collectedData.groupName || '';
        goalData.goalMode = collectedData.goalMode || 'common';
      }

      if (collectedData.isRecurring) {
        goalData.isRecurring = true;
        goalData.recurrencePattern = collectedData.recurrencePattern || 'weekly';
        goalData.recurrenceEndDate = collectedData.recurrenceEndDate || '';
      }

      // Include AI evaluated criteria and clarifications
      if (collectedData.evaluatedCriteria) {
        goalData.evaluatedCriteria = collectedData.evaluatedCriteria;
      }
      if (collectedData.clarifications && collectedData.clarifications.length > 0) {
        goalData.clarifications = collectedData.clarifications;
      }

      const result = await goalsApi.create(goalData);

      const isGiftGoal = result.needsAcceptance;
      const isRecurringGoal = result.totalGoals && result.totalGoals > 1;
      const isGroupGoal = collectedData.goalType === 'group';

      Alert.alert(
        isGroupGoal ? 'Group Goal Created! 👥' : (isRecurringGoal ? 'Recurring Goals Created! 🔄' : (isGiftGoal ? 'Goal Created! 🎁' : 'Goal Created! 🎯')),
        isGroupGoal
          ? `Group "${collectedData.groupName}" has been created! Share the link with friends to invite them to join.`
          : (isRecurringGoal
            ? `${result.totalGoals} recurring goals have been created. The first goal is now active.`
            : (isGiftGoal
              ? `Your goal "${result.goal.title}" has been created. Share the link with ${collectedData.seekerEmail || 'the goal seeker'} so they can accept it!`
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
    if (!currentQuestion || loading || showTextInput) return null;

    if (!currentQuestion.options || currentQuestion.options.length === 0) {
      // Free text input
      return (
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your answer..."
            placeholderTextColor="#6B7280"
            value={textInputValue}
            onChangeText={setTextInputValue}
            multiline={currentQuestion.id === 'description' || currentQuestion.id === 'verificationCriteria'}
            numberOfLines={currentQuestion.id === 'description' || currentQuestion.id === 'verificationCriteria' ? 4 : 1}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.submitButton, !textInputValue.trim() && styles.submitButtonDisabled]}
            onPress={handleTextInputSubmit}
            disabled={!textInputValue.trim()}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      );
    }

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
            <Text style={styles.summaryLabel}>Goal Type</Text>
            <Text style={styles.summaryValue}>
              {collectedData.goalType === 'self' ? 'For Self' : 
               collectedData.goalType === 'gift' ? 'For Someone Else' : 
               'Group Goal'}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Title</Text>
            <Text style={styles.summaryValue}>{collectedData.title}</Text>
          </View>
          
          {collectedData.description && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Description</Text>
              <Text style={styles.summaryValue}>{collectedData.description}</Text>
            </View>
          )}
          
          {collectedData.startDate && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Start Date</Text>
              <Text style={styles.summaryValue}>{formatDate(collectedData.startDate)}</Text>
            </View>
          )}
          
          {collectedData.deadline && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Deadline</Text>
              <Text style={styles.summaryValue}>{formatDate(collectedData.deadline)}</Text>
            </View>
          )}
          
          {collectedData.seedAmount && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Seed Money</Text>
              <Text style={styles.summaryValue}>{formatCentsToDollars(collectedData.seedAmount)}</Text>
            </View>
          )}
          
          {collectedData.isRecurring && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Recurring</Text>
                <Text style={styles.summaryValue}>Yes ({collectedData.recurrencePattern})</Text>
              </View>
              {collectedData.recurrenceEndDate && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Recurrence End Date</Text>
                  <Text style={styles.summaryValue}>{formatDate(collectedData.recurrenceEndDate)}</Text>
                </View>
              )}
            </>
          )}
          
          {collectedData.goalType === 'gift' && collectedData.seekerEmail && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Seeker Email</Text>
              <Text style={styles.summaryValue}>{collectedData.seekerEmail}</Text>
            </View>
          )}
          
          {collectedData.goalType === 'group' && (
            <>
              {collectedData.groupName && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Group Name</Text>
                  <Text style={styles.summaryValue}>{collectedData.groupName}</Text>
                </View>
              )}
              {collectedData.goalMode && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Goal Mode</Text>
                  <Text style={styles.summaryValue}>
                    {collectedData.goalMode === 'common' ? 'Common Goal' : 'Individual Goals'}
                  </Text>
                </View>
              )}
            </>
          )}
          
          {collectedData.verificationCriteria && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Verification Criteria</Text>
              <Text style={styles.summaryValue}>{collectedData.verificationCriteria}</Text>
            </View>
          )}

          {/* Clarifications collected during creation */}
          {collectedData.clarifications && collectedData.clarifications.length > 0 && (
            <View style={styles.clarificationsSection}>
              <Text style={styles.clarificationsTitle}>Clarifications</Text>
              {collectedData.clarifications.map((c, index) => (
                <View key={index} style={styles.clarificationItem}>
                  <Text style={styles.clarificationQuestion}>Q: {c.question}</Text>
                  <Text style={styles.clarificationAnswer}>A: {c.answer}</Text>
                </View>
              ))}
            </View>
          )}

          {/* AI Evaluated Criteria - shows how AI will evaluate success */}
          {collectedData.evaluatedCriteria && (
            <View style={styles.evaluatedCriteriaSection}>
              <Text style={styles.evaluatedCriteriaTitle}>AI Evaluation Criteria</Text>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>🎯 Key KPI</Text>
                <Text style={styles.criteriaValue}>{collectedData.evaluatedCriteria.keyKPI}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>📍 Current Status</Text>
                <Text style={styles.criteriaValue}>{collectedData.evaluatedCriteria.currentStatus}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>🏁 Target KPI</Text>
                <Text style={styles.criteriaValue}>{collectedData.evaluatedCriteria.targetKPI}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>📊 Progress Measurement</Text>
                <Text style={styles.criteriaValue}>{collectedData.evaluatedCriteria.progressMeasurement}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>✅ Success Criteria</Text>
                <Text style={styles.criteriaValue}>{collectedData.evaluatedCriteria.successCriteria}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>❌ Failure Criteria</Text>
                <Text style={styles.criteriaValue}>{collectedData.evaluatedCriteria.failureCriteria}</Text>
              </View>
              
              <View style={styles.criteriaItem}>
                <Text style={styles.criteriaLabel}>📸 Proof Method</Text>
                <Text style={styles.criteriaValue}>{collectedData.evaluatedCriteria.proofMethod}</Text>
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
        <Text style={styles.headerTitle}>AI Goal Creation</Text>
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
          <Text style={styles.welcomeTitle}>Goal Creation Assistant</Text>
          <Text style={styles.welcomeSubtitle}>
            I'll help you create a goal by asking a few questions
          </Text>
        </View>

        {/* Messages */}
        {messages.map((message, index) => renderMessage(message, index))}

        {/* Question options */}
        {renderQuestionOptions()}

        {/* Summary when ready */}
        {renderSummary()}
      </ScrollView>

      {/* Date Picker Modal for iOS */}
      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerModal}>
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display="default"
              onChange={handleDatePickerChange}
              minimumDate={new Date()}
            />
            <View style={styles.datePickerButtons}>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.datePickerButton, styles.datePickerButtonPrimary]}
                onPress={handleDateConfirm}
              >
                <Text style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Date Picker for Android */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display="default"
          onChange={handleDatePickerChange}
          minimumDate={new Date()}
        />
      )}
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
  textInputContainer: {
    marginTop: 8,
    marginBottom: 16,
    marginLeft: 46,
  },
  textInput: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    padding: 16,
    color: '#F9FAFB',
    fontSize: 15,
    minHeight: 50,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    fontWeight: '600',
    marginBottom: 12,
  },
  clarificationItem: {
    marginBottom: 12,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#6366F1',
  },
  clarificationQuestion: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 2,
  },
  clarificationAnswer: {
    color: '#F9FAFB',
    fontSize: 14,
  },
  evaluatedCriteriaSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  evaluatedCriteriaTitle: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  criteriaItem: {
    marginBottom: 14,
  },
  criteriaLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  criteriaValue: {
    color: '#F9FAFB',
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 8,
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
  datePickerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  datePickerButton: {
    padding: 12,
    borderRadius: 8,
  },
  datePickerButtonPrimary: {
    backgroundColor: '#6366F1',
  },
  datePickerButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerButtonTextPrimary: {
    color: '#FFFFFF',
  },
});

export default AIGoalCreationScreen;

