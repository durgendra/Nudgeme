import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';
import { goalsApi } from '../services/api';
import { formatCentsToDollars, formatDate } from '../utils/formatters';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateGoal'>;
  route: RouteProp<RootStackParamList, 'CreateGoal'>;
};

const CreateGoalScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const goalType = route.params?.goalType || 'self';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [seedAmount, setSeedAmount] = useState('');
  
  // Start date - defaults to today
  const [startDate, setStartDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  
  // Deadline - for non-recurring goals only
  const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days from now
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  
  const [verificationCriteria, setVerificationCriteria] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Seeker mode state - set based on goalType from route params
  const [isForSomeoneElse, setIsForSomeoneElse] = useState(goalType === 'gift');
  const [seekerEmail, setSeekerEmail] = useState('');

  // Group goal state
  const [groupName, setGroupName] = useState('');
  const [goalMode, setGoalMode] = useState<'common' | 'individual'>('common');

  // Recurring goal state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days from now
  const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'startDate' | 'deadline' | 'recurrenceEnd'>('startDate');

  // Update isForSomeoneElse when goalType changes
  useEffect(() => {
    setIsForSomeoneElse(goalType === 'gift');
  }, [goalType]);

  // Helper to check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Calculate first deadline for recurring goals based on start date + frequency
  const getFirstRecurringDeadline = (): Date => {
    const firstDeadline = new Date(startDate);
    switch (recurrencePattern) {
      case 'daily':
        firstDeadline.setDate(firstDeadline.getDate() + 1);
        break;
      case 'weekly':
        firstDeadline.setDate(firstDeadline.getDate() + 7);
        break;
      case 'monthly':
        firstDeadline.setMonth(firstDeadline.getMonth() + 1);
        break;
    }
    return firstDeadline;
  };

  // Calculate number of recurring goals
  const calculateRecurringCount = (): number => {
    if (!isRecurring) return 1;
    
    let count = 1;
    const firstDeadline = getFirstRecurringDeadline();
    let currentDate = new Date(firstDeadline);
    const endDate = new Date(recurrenceEndDate);
    
    while (currentDate < endDate) {
      let nextDate = new Date(currentDate);
      switch (recurrencePattern) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }
      
      if (nextDate <= endDate) {
        count++;
        currentDate = nextDate;
      } else {
        break;
      }
    }
    
    return count;
  };

  const recurringCount = calculateRecurringCount();

  const PLATFORM_FEE = 5; // 5%

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate group name for group goals
    if (goalType === 'group' && !groupName.trim()) {
      newErrors.groupName = 'Group name is required';
    }

    if (!title.trim()) {
      newErrors.title = goalType === 'group' && goalMode === 'individual' 
        ? 'Your goal title is required' 
        : 'Title is required';
    }

    const amount = parseFloat(seedAmount);
    if (!seedAmount || isNaN(amount) || amount < 1) {
      newErrors.seedAmount = 'Minimum seed amount is $1';
    }

    // Start date validation - must be today or in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    
    if (startDateNormalized < today) {
      newErrors.startDate = 'Start date must be today or in the future';
    }

    // For non-recurring goals, validate deadline
    if (!isRecurring) {
      if (deadline <= startDate) {
        newErrors.deadline = 'Deadline must be after the start date';
      }
    }

    // Validate seeker email if creating for someone else
    if (isForSomeoneElse && seekerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(seekerEmail.trim())) {
        newErrors.seekerEmail = 'Please enter a valid email address';
      }
    }

    // Validate recurring goal fields
    if (isRecurring) {
      const firstDeadline = getFirstRecurringDeadline();
      if (recurrenceEndDate <= firstDeadline) {
        newErrors.recurrenceEndDate = 'End date must be after the first deadline';
      }
      if (recurringCount > 52) {
        newErrors.recurrenceEndDate = 'Maximum 52 recurring goals allowed';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;

    const amount = Math.round(parseFloat(seedAmount) * 100); // Convert to cents
    
    // For recurring goals, deadline is calculated from start date + frequency
    const effectiveDeadline = isRecurring ? getFirstRecurringDeadline() : deadline;
    
    // Navigate to AI clarification screen instead of directly creating
    navigation.navigate('AIGoalClarification', {
      goalData: {
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate.toISOString(),
        deadline: effectiveDeadline.toISOString(),
        seedAmount: amount,
        verificationCriteria: verificationCriteria.trim() || undefined,
        seekerEmail: isForSomeoneElse && seekerEmail.trim() ? seekerEmail.trim() : undefined,
        goalType,
        // Group goal fields
        groupName: goalType === 'group' ? groupName.trim() : undefined,
        goalMode: goalType === 'group' ? goalMode : undefined,
        // Recurring goal fields
        isRecurring: isRecurring || undefined,
        recurrencePattern: isRecurring ? recurrencePattern : undefined,
        recurrenceEndDate: isRecurring ? recurrenceEndDate.toISOString() : undefined,
      },
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowStartDatePicker(false);
      setShowDeadlinePicker(false);
      setShowRecurrenceEndDatePicker(false);
    }
    
    if (selectedDate) {
      if (datePickerMode === 'startDate') {
        setStartDate(selectedDate);
        // If start date is moved past deadline, also move deadline
        if (!isRecurring && selectedDate >= deadline) {
          const newDeadline = new Date(selectedDate);
          newDeadline.setDate(newDeadline.getDate() + 7);
          setDeadline(newDeadline);
        }
      } else if (datePickerMode === 'deadline') {
        setDeadline(selectedDate);
      } else {
        setRecurrenceEndDate(selectedDate);
      }
    }
  };

  const openStartDatePicker = () => {
    setDatePickerMode('startDate');
    setShowStartDatePicker(true);
  };

  const openDeadlinePicker = () => {
    setDatePickerMode('deadline');
    setShowDeadlinePicker(true);
  };

  const openRecurrenceEndDatePicker = () => {
    setDatePickerMode('recurrenceEnd');
    setShowRecurrenceEndDatePicker(true);
  };

  const seedAmountCents = Math.round((parseFloat(seedAmount) || 0) * 100);
  const estimatedFee = Math.round(seedAmountCents * (PLATFORM_FEE / 100));
  const estimatedPayout = seedAmountCents - estimatedFee;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
      {/* AI Assistance Option */}
      <TouchableOpacity
        style={styles.aiAssistButton}
        onPress={() => navigation.navigate('AIGoalCreation')}
      >
        <Text style={styles.aiAssistIcon}>🤖</Text>
        <View style={styles.aiAssistTextContainer}>
          <Text style={styles.aiAssistTitle}>I'm not sure. I need help to create a goal</Text>
          <Text style={styles.aiAssistSubtitle}>Let AI guide you through the process</Text>
        </View>
        <Text style={styles.aiAssistArrow}>→</Text>
      </TouchableOpacity>

      {/* Goal Type Info */}
      <View style={styles.goalTypeInfo}>
        <Text style={styles.goalTypeText}>
          {goalType === 'self' && '🎯 Creating goal for yourself'}
          {goalType === 'gift' && '🎁 Creating goal for someone else'}
          {goalType === 'group' && '👥 Creating group goal'}
        </Text>
      </View>

      {/* Group Name - Only for group goals */}
      {goalType === 'group' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Group Name *</Text>
          <TextInput
            style={[styles.input, errors.groupName && styles.inputError]}
            placeholder="e.g., Fitness Challenge 2024"
            placeholderTextColor={theme.colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={200}
          />
          {errors.groupName && <Text style={styles.errorText}>{errors.groupName}</Text>}
          <Text style={styles.helperText}>
            A name to identify your group
          </Text>
        </View>
      )}

      {/* Goal Mode - Only for group goals */}
      {goalType === 'group' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Goal Type</Text>
          <View style={styles.goalModeOptions}>
            <TouchableOpacity
              style={[
                styles.goalModeOption,
                goalMode === 'common' && styles.goalModeOptionActive
              ]}
              onPress={() => setGoalMode('common')}
            >
              <Text style={styles.goalModeIcon}>🎯</Text>
              <Text style={[
                styles.goalModeTitle,
                goalMode === 'common' && styles.goalModeTextActive
              ]}>Common Goal</Text>
              <Text style={styles.goalModeDescription}>
                Everyone works toward the same goal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.goalModeOption,
                goalMode === 'individual' && styles.goalModeOptionActive
              ]}
              onPress={() => setGoalMode('individual')}
            >
              <Text style={styles.goalModeIcon}>🎨</Text>
              <Text style={[
                styles.goalModeTitle,
                goalMode === 'individual' && styles.goalModeTextActive
              ]}>Individual Goals</Text>
              <Text style={styles.goalModeDescription}>
                Each person sets their own goal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Title */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          {goalType === 'group' && goalMode === 'individual' ? 'Your Goal Title *' : 'Goal Title *'}
        </Text>
        <TextInput
          style={[styles.input, errors.title && styles.inputError]}
          placeholder="e.g., Run a marathon"
          placeholderTextColor={theme.colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
      </View>

      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, errors.description && styles.inputError]}
          placeholder="Describe your goal and what you want to achieve..."
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={2000}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      </View>

      {/* Seed Amount */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Seed Money (USD) *</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={[styles.amountInput, errors.seedAmount && styles.inputError]}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textMuted}
            value={seedAmount}
            onChangeText={setSeedAmount}
            keyboardType="decimal-pad"
          />
        </View>
        {errors.seedAmount && <Text style={styles.errorText}>{errors.seedAmount}</Text>}
        <Text style={styles.helperText}>
          This amount will be deducted from your wallet
        </Text>
      </View>

      {/* Start Date */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Start Date *</Text>
        <TouchableOpacity
          style={[styles.input, styles.dateInput, errors.startDate && styles.inputError]}
          onPress={openStartDatePicker}
        >
          <View style={styles.dateTextContainer}>
            <Text style={styles.dateText}>{formatDate(startDate.toISOString())}</Text>
            {isToday(startDate) && <Text style={styles.todayBadge}>Today</Text>}
          </View>
          <Text style={styles.dateIcon}>📅</Text>
        </TouchableOpacity>
        {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
        <Text style={styles.helperText}>
          When does this goal officially begin?
        </Text>
      </View>

      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()} // Today or later
        />
      )}

      {/* Deadline - only for non-recurring goals */}
      {!isRecurring && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Deadline *</Text>
          <TouchableOpacity
            style={[styles.input, styles.dateInput, errors.deadline && styles.inputError]}
            onPress={openDeadlinePicker}
          >
            <Text style={styles.dateText}>{formatDate(deadline.toISOString())}</Text>
            <Text style={styles.dateIcon}>📅</Text>
          </TouchableOpacity>
          {errors.deadline && <Text style={styles.errorText}>{errors.deadline}</Text>}
        </View>
      )}

      {showDeadlinePicker && (
        <DateTimePicker
          value={deadline}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date(startDate.getTime() + 24 * 60 * 60 * 1000)} // Day after start date
        />
      )}

      {/* Recurring Goal Toggle */}
      <View style={styles.toggleContainer}>
        <View style={styles.toggleTextContainer}>
          <Text style={styles.toggleLabel}>Make this a recurring goal</Text>
          <Text style={styles.toggleDescription}>
            Create multiple goals that repeat on a schedule
          </Text>
        </View>
        <Switch
          value={isRecurring}
          onValueChange={setIsRecurring}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor={isRecurring ? '#FFFFFF' : theme.colors.textSecondary}
        />
      </View>

      {/* Recurring Goal Options */}
      {isRecurring && (
        <View style={styles.recurringSection}>
          {/* Frequency Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Repeat Frequency</Text>
            <View style={styles.frequencyOptions}>
              {(['daily', 'weekly', 'monthly'] as const).map((pattern) => (
                <TouchableOpacity
                  key={pattern}
                  style={[
                    styles.frequencyOption,
                    recurrencePattern === pattern && styles.frequencyOptionActive
                  ]}
                  onPress={() => setRecurrencePattern(pattern)}
                >
                  <Text style={[
                    styles.frequencyOptionText,
                    recurrencePattern === pattern && styles.frequencyOptionTextActive
                  ]}>
                    {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recurrence End Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Repeat Until *</Text>
            <TouchableOpacity
              style={[styles.input, styles.dateInput, errors.recurrenceEndDate && styles.inputError]}
              onPress={openRecurrenceEndDatePicker}
            >
              <Text style={styles.dateText}>{formatDate(recurrenceEndDate.toISOString())}</Text>
              <Text style={styles.dateIcon}>📅</Text>
            </TouchableOpacity>
            {errors.recurrenceEndDate && <Text style={styles.errorText}>{errors.recurrenceEndDate}</Text>}
          </View>

          {showRecurrenceEndDatePicker && (
            <DateTimePicker
              value={recurrenceEndDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date(getFirstRecurringDeadline().getTime() + 24 * 60 * 60 * 1000)} // Day after first deadline
            />
          )}

          {/* Recurring Preview */}
          <View style={styles.recurringPreview}>
            <Text style={styles.recurringPreviewTitle}>🔄 Recurring Goal Preview</Text>
            <Text style={styles.recurringPreviewText}>
              This will create <Text style={styles.recurringPreviewHighlight}>{recurringCount} goals</Text> that repeat {recurrencePattern}.
            </Text>
            <View style={styles.recurringDeadlinePreview}>
              <Text style={styles.recurringDeadlineLabel}>First deadline:</Text>
              <Text style={styles.recurringDeadlineValue}>{formatDate(getFirstRecurringDeadline().toISOString())}</Text>
            </View>
            <Text style={styles.recurringPreviewNote}>
              • First goal will be active {isToday(startDate) ? 'immediately' : `on ${formatDate(startDate.toISOString())}`}{'\n'}
              • Each goal deadline is {recurrencePattern === 'daily' ? '1 day' : recurrencePattern === 'weekly' ? '7 days' : '1 month'} after the previous{'\n'}
              • Seed money ({formatCentsToDollars(Math.round((parseFloat(seedAmount) || 0) * 100))}) will be deducted for each goal as it activates
            </Text>
          </View>
        </View>
      )}

      {/* Verification Criteria */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Verification Criteria (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What proof should the AI look for? e.g., 'A photo showing the marathon finish line medal'"
          placeholderTextColor={theme.colors.textMuted}
          value={verificationCriteria}
          onChangeText={setVerificationCriteria}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
        <Text style={styles.helperText}>
          This helps our AI verify your goal completion
        </Text>
      </View>

      {/* Group Goal Info */}
      {goalType === 'group' && (
        <View style={styles.groupInfo}>
          <Text style={styles.groupTitle}>
            {goalMode === 'common' ? '👥 How common goals work' : '🎨 How individual goals work'}
          </Text>
          <Text style={styles.groupText}>
            {goalMode === 'common' ? (
              `• All participants work toward the same goal\n` +
              `• Each participant contributes to a shared pot\n` +
              `• Each participant must submit their own proof\n` +
              `• Pot is divided equally among successful participants\n` +
              `• If no one completes, entire pot is forfeited`
            ) : (
              `• Each person creates their own goal with their own title\n` +
              `• All goals share the same deadline\n` +
              `• Each participant contributes to a shared pot\n` +
              `• Pot is divided equally among those who complete their goal\n` +
              `• When you share the group, others can join and set their own goal`
            )}
          </Text>
        </View>
      )}

      {/* Seeker Email */}
      {isForSomeoneElse && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Goal Seeker's Email (Optional)</Text>
          <TextInput
            style={[styles.input, errors.seekerEmail && styles.inputError]}
            placeholder="friend@example.com"
            placeholderTextColor={theme.colors.textMuted}
            value={seekerEmail}
            onChangeText={setSeekerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.seekerEmail && <Text style={styles.errorText}>{errors.seekerEmail}</Text>}
          <Text style={styles.helperText}>
            If provided, only this person can accept the goal. Otherwise, anyone with the link can accept.
          </Text>
        </View>
      )}

      {/* Info box for gift goals */}
      {isForSomeoneElse && (
        <View style={styles.giftInfo}>
          <Text style={styles.giftTitle}>🎁 How gift goals work</Text>
          <Text style={styles.giftText}>
            • You pay the seed money upfront{'\n'}
            • Share the goal link with the recipient{'\n'}
            • They accept and become the goal seeker{'\n'}
            • You become a supporter (participant){'\n'}
            • If they succeed, they get the payout{'\n'}
            • If they fail, you get your seed money back
          </Text>
        </View>
      )}

      {/* Fee Preview */}
      {seedAmountCents > 0 && (
        <View style={styles.feePreview}>
          <Text style={styles.feeTitle}>If you succeed...</Text>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Your seed money</Text>
            <Text style={styles.feeValue}>{formatCentsToDollars(seedAmountCents)}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>+ Participant contributions</Text>
            <Text style={styles.feeValue}>$?.??</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Platform fee ({PLATFORM_FEE}%)</Text>
            <Text style={[styles.feeValue, { color: theme.colors.danger }]}>
              -{formatCentsToDollars(estimatedFee)}*
            </Text>
          </View>
          <View style={[styles.feeRow, styles.feeTotal]}>
            <Text style={styles.feeTotalLabel}>Minimum you'll receive</Text>
            <Text style={styles.feeTotalValue}>{formatCentsToDollars(estimatedPayout)}</Text>
          </View>
          <Text style={styles.feeNote}>
            * Fee calculated on total pot. Actual payout increases with participants.
          </Text>
        </View>
      )}

      {/* If you fail info */}
      {goalType === 'group' ? (
        <View style={styles.failInfo}>
          <Text style={styles.failTitle}>If no one completes by deadline...</Text>
          <Text style={styles.failText}>
            • Entire pot is forfeited to the platform{'\n'}
            • Only participants who successfully complete get their share{'\n'}
            • Pot is divided equally among successful participants (minus platform fee)
          </Text>
        </View>
      ) : (
        <View style={styles.failInfo}>
          <Text style={styles.failTitle}>If you don't complete by deadline...</Text>
          <Text style={styles.failText}>
            • Participants get their contributions refunded{'\n'}
            • Your seed money is split among participants{'\n'}
            • No platform fee is charged
          </Text>
        </View>
      )}

      {/* Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreate}
      >
        <Text style={styles.createButtonText}>
          {isRecurring ? `Review ${recurringCount} Goals with AI` : 'Review Goal with AI'}
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: theme.isDark ? '#D1D5DB' : theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.input,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currencySymbol: {
    color: theme.colors.textSecondary,
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    paddingLeft: 16,
  },
  amountInput: {
    flex: 1,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.isDark ? 'JetBrainsMono-Bold' : 'Inter-SemiBold',
    borderWidth: 0,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  todayBadge: {
    backgroundColor: theme.colors.success,
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dateIcon: {
    fontSize: 20,
  },
  feePreview: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 20,
    marginBottom: 20,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
  },
  feeTitle: {
    color: theme.colors.success,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 16,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  feeValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.isDark ? 'JetBrainsMono-Regular' : 'Inter-Medium',
  },
  feeTotal: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  feeTotalLabel: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  feeTotalValue: {
    color: theme.colors.success,
    fontSize: 16,
    fontFamily: theme.isDark ? 'JetBrainsMono-Bold' : 'Inter-Bold',
  },
  feeNote: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 12,
    fontStyle: 'italic',
  },
  failInfo: {
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 20,
    marginBottom: 24,
  },
  failTitle: {
    color: theme.isDark ? '#FCA5A5' : theme.colors.danger,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
  },
  failText: {
    color: theme.isDark ? '#FECACA' : theme.colors.danger,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.input,
    padding: 16,
    marginBottom: 20,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  toggleDescription: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  giftInfo: {
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  giftTitle: {
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
  },
  giftText: {
    color: theme.isDark ? '#BFDBFE' : theme.colors.info,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.button,
    padding: 18,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  goalTypeInfo: {
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.input,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  goalTypeText: {
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  groupInfo: {
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  groupTitle: {
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
  },
  groupText: {
    color: theme.isDark ? '#BFDBFE' : theme.colors.info,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  // Goal mode styles
  goalModeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  goalModeOption: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.input,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  goalModeOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.infoBg,
  },
  goalModeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  goalModeTitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  goalModeTextActive: {
    color: theme.isDark ? '#93C5FD' : theme.colors.primary,
  },
  goalModeDescription: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 14,
  },
  // Recurring goal styles
  recurringSection: {
    marginBottom: 20,
  },
  frequencyOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  frequencyOption: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.input,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  frequencyOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.infoBg,
  },
  frequencyOptionText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  frequencyOptionTextActive: {
    color: theme.isDark ? '#93C5FD' : theme.colors.primary,
  },
  recurringPreview: {
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  recurringPreviewTitle: {
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
  },
  recurringPreviewText: {
    color: theme.isDark ? '#BFDBFE' : theme.colors.info,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  recurringPreviewHighlight: {
    color: theme.colors.secondary,
    fontFamily: 'Inter-Bold',
  },
  recurringDeadlinePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  recurringDeadlineLabel: {
    color: theme.isDark ? '#93C5FD' : theme.colors.primary,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  recurringDeadlineValue: {
    color: theme.colors.secondary,
    fontSize: 13,
    fontFamily: 'Inter-Bold',
  },
  recurringPreviewNote: {
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  aiAssistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.input,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  aiAssistIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  aiAssistTextContainer: {
    flex: 1,
  },
  aiAssistTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  aiAssistSubtitle: {
    color: theme.isDark ? '#93C5FD' : theme.colors.primary,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  aiAssistArrow: {
    color: theme.colors.primary,
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
  },
});

export default CreateGoalScreen;
