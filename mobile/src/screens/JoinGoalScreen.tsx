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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Goal, GroupGoal } from '../types';
import { goalsApi, paymentsApi } from '../services/api';
import { formatCentsToDollars } from '../utils/formatters';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'JoinGoal'>;
  route: RouteProp<RootStackParamList, 'JoinGoal'>;
};

const JoinGoalScreen: React.FC<Props> = ({ navigation, route }) => {
  const { goalId, shareCode, groupGoalId } = route.params;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [groupGoal, setGroupGoal] = useState<GroupGoal | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [contribution, setContribution] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [hasSeeker, setHasSeeker] = useState(false);
  
  // Individual goal fields (for individual mode group goals)
  const [individualTitle, setIndividualTitle] = useState('');
  const [individualDescription, setIndividualDescription] = useState('');
  const [individualVerificationCriteria, setIndividualVerificationCriteria] = useState('');

  const goalIdentifier = groupGoalId || goalId || shareCode || '';

  useEffect(() => {
    if (goalIdentifier) {
      loadData();
    } else {
      Alert.alert('Error', 'No goal ID or share code provided');
      navigation.goBack();
    }
  }, [goalIdentifier]);

  const loadData = async () => {
    try {
      const walletData = await paymentsApi.getWalletBalance();
      setWalletBalance(walletData.balanceCents);

      // Check if this is a group goal by trying to load it as a group goal first
      if (groupGoalId) {
        const groupGoalData = await goalsApi.getGroupGoal(groupGoalId);
        setGroupGoal(groupGoalData.groupGoal);
        setIsCreator(groupGoalData.isGroupCreator);
        // Set minimum contribution for group goals
        setContribution((groupGoalData.groupGoal.minSeedAmount / 100).toFixed(2));
        
        // For common mode, also get the shared goal
        if (groupGoalData.groupGoal.goalMode === 'common' && groupGoalData.participantGoals.length > 0) {
          setGoal(groupGoalData.participantGoals[0]);
        }
      } else {
        const goalData = await goalsApi.getById(goalIdentifier);
        setGoal(goalData.goal);
        setIsCreator(goalData.isCreator);
        setHasSeeker(!!goalData.goal.seekerId);
        
        // Check if this goal is part of a group goal
        if (goalData.groupGoalInfo?.groupGoal) {
          setGroupGoal(goalData.groupGoalInfo.groupGoal);
          // Set minimum contribution for group goals
          setContribution((goalData.groupGoalInfo.groupGoal.minSeedAmount / 100).toFixed(2));
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load goal details. Please check the share code and try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const amount = Math.round((parseFloat(contribution) || 0) * 100);
    
    // Validation for group goals with individual mode
    if (groupGoal && groupGoal.goalMode === 'individual' && !individualTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your goal');
      return;
    }
    
    // Check minimum contribution for group goals
    if (groupGoal && amount < groupGoal.minSeedAmount) {
      Alert.alert('Minimum Contribution', `Minimum contribution is ${formatCentsToDollars(groupGoal.minSeedAmount)}`);
      return;
    }
    
    // Creator adding more support requires contribution > 0
    if (isCreator && amount <= 0) {
      Alert.alert('Add Contribution', 'Please enter an amount to add to your support.');
      return;
    }

    if (amount > walletBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${formatCentsToDollars(amount)} but only have ${formatCentsToDollars(walletBalance)} in your wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => navigation.navigate('AddFunds') },
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      // Handle group goal joining
      if (groupGoal) {
        const result = await goalsApi.joinGroupGoal(groupGoal._id, {
          contributionAmount: amount,
          title: groupGoal.goalMode === 'individual' ? individualTitle.trim() : undefined,
          description: groupGoal.goalMode === 'individual' ? individualDescription.trim() || undefined : undefined,
          verificationCriteria: groupGoal.goalMode === 'individual' ? individualVerificationCriteria.trim() || undefined : undefined,
        });
        
        const successMessage = groupGoal.goalMode === 'individual'
          ? `Your goal "${individualTitle}" has been created in the group!`
          : `You've joined the group with ${formatCentsToDollars(amount)}!`;
        
        Alert.alert(
          'Success! 🎉',
          successMessage,
          [
            {
              text: 'View Goal',
              onPress: () => {
                if (result.goal) {
                  navigation.replace('GoalDetail', { goalId: result.goal._id, groupGoalId: groupGoal._id });
                } else {
                  navigation.replace('GoalDetail', { groupGoalId: groupGoal._id });
                }
              },
            },
          ]
        );
      } else if (goal) {
        // Regular goal joining
        const identifier = goalId || shareCode || goal._id;
        await goalsApi.join(identifier, amount);
        
        const successMessage = isCreator
          ? `You've added ${formatCentsToDollars(amount)} more support to the goal!`
          : amount > 0 
            ? `You've joined the goal with a ${formatCentsToDollars(amount)} contribution!`
            : "You've joined the goal!";
        
        Alert.alert(
          'Success! 🎉',
          successMessage,
          [
            {
              text: 'View Goal',
              onPress: () => navigation.replace('GoalDetail', { goalId: goal._id }),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join goal');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!goal && !groupGoal) {
    return null;
  }

  const contributionCents = Math.round((parseFloat(contribution) || 0) * 100);
  const currentPot = groupGoal ? groupGoal.sharedPot : (goal?.totalPot || 0);
  const newTotalPot = currentPot + contributionCents;

  // Determine recipient label
  const recipientLabel = groupGoal ? 'Successful participants' : (hasSeeker ? 'Goal seeker' : 'Creator');
  const isIndividualMode = groupGoal?.goalMode === 'individual';

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
      {/* Creator adding more info */}
      {isCreator && !groupGoal && (
        <View style={styles.creatorInfo}>
          <Text style={styles.creatorInfoTitle}>🎁 Add More Support</Text>
          <Text style={styles.creatorInfoText}>
            You created this goal for someone else. Add additional funds to increase the pot!
          </Text>
        </View>
      )}

      {/* Group Goal Header */}
      {groupGoal && (
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{groupGoal.groupName}</Text>
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>
              {isIndividualMode ? '🎨 Individual Goals' : '🎯 Common Goal'}
            </Text>
          </View>
        </View>
      )}

      {/* Goal Summary */}
      <View style={styles.goalCard}>
        <Text style={styles.goalTitle}>
          {groupGoal 
            ? (isIndividualMode ? 'Join this Group' : (goal?.title || groupGoal.groupName))
            : goal?.title}
        </Text>
        <Text style={styles.goalDescription} numberOfLines={3}>
          {groupGoal 
            ? (isIndividualMode 
              ? 'Create your own goal with your own title. All participants share the same deadline and contribute to a shared pot.'
              : goal?.description || 'Join this group goal and work together!')
            : goal?.description}
        </Text>
        <View style={styles.goalStats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{groupGoal ? 'Shared Pot' : 'Current Pot'}</Text>
            <Text style={styles.statValue}>{formatCentsToDollars(currentPot)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{groupGoal ? 'Min Contribution' : 'Seed Money'}</Text>
            <Text style={styles.statValue}>
              {formatCentsToDollars(groupGoal ? groupGoal.minSeedAmount : (goal?.seedAmount || 0))}
            </Text>
          </View>
        </View>
      </View>

      {/* Individual Goal Form - for individual mode group goals */}
      {isIndividualMode && (
        <View style={styles.individualGoalForm}>
          <Text style={styles.formTitle}>Your Goal Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Goal Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Run 5K"
              placeholderTextColor="#6B7280"
              value={individualTitle}
              onChangeText={setIndividualTitle}
              maxLength={200}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe your goal..."
              placeholderTextColor="#6B7280"
              value={individualDescription}
              onChangeText={setIndividualDescription}
              multiline
              numberOfLines={3}
              maxLength={2000}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Verification Criteria (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="What proof should be submitted?"
              placeholderTextColor="#6B7280"
              value={individualVerificationCriteria}
              onChangeText={setIndividualVerificationCriteria}
              multiline
              numberOfLines={2}
              maxLength={500}
            />
          </View>
        </View>
      )}

      {/* Wallet Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Wallet Balance</Text>
        <Text style={styles.balanceValue}>{formatCentsToDollars(walletBalance)}</Text>
        <TouchableOpacity
          style={styles.addFundsLink}
          onPress={() => navigation.navigate('AddFunds')}
        >
          <Text style={styles.addFundsText}>+ Add Funds</Text>
        </TouchableOpacity>
      </View>

      {/* Contribution Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{isCreator ? 'Additional Contribution' : 'Your Contribution (Optional)'}</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor="#6B7280"
            value={contribution}
            onChangeText={setContribution}
            keyboardType="decimal-pad"
          />
        </View>
        <Text style={styles.helperText}>
          {isCreator 
            ? 'Add more money to increase the pot and show your support!'
            : `You can join with $0 to just support the ${recipientLabel.toLowerCase()}, or add money to increase the pot!`
          }
        </Text>
      </View>

      {/* Quick Amount Buttons */}
      <View style={styles.quickAmounts}>
        {['0', '5', '10', '25', '50'].map((amount) => (
          <TouchableOpacity
            key={amount}
            style={[
              styles.quickAmountButton,
              contribution === amount && styles.quickAmountButtonActive,
            ]}
            onPress={() => setContribution(amount)}
          >
            <Text
              style={[
                styles.quickAmountText,
                contribution === amount && styles.quickAmountTextActive,
              ]}
            >
              ${amount}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        {groupGoal ? (
          <>
            <Text style={styles.summaryTitle}>If you complete your goal:</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>New shared pot</Text>
              <Text style={styles.summaryValue}>{formatCentsToDollars(newTotalPot)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Split among successful participants</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>~95%</Text>
            </View>
            
            <Text style={[styles.summaryTitle, { marginTop: 20 }]}>If you don't complete:</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Your contribution</Text>
              <Text style={styles.summaryValue}>Goes to successful participants</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>If no one completes</Text>
              <Text style={[styles.summaryValue, { color: '#EF4444' }]}>Pot forfeited</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.summaryTitle}>If the {recipientLabel.toLowerCase()} succeeds:</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>New total pot</Text>
              <Text style={styles.summaryValue}>{formatCentsToDollars(newTotalPot)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{recipientLabel} receives (~95%)</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                {formatCentsToDollars(Math.floor(newTotalPot * 0.95))}
              </Text>
            </View>
            
            <Text style={[styles.summaryTitle, { marginTop: 20 }]}>If the {recipientLabel.toLowerCase()} fails:</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You get back</Text>
              <Text style={styles.summaryValue}>{formatCentsToDollars(contributionCents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>+ Share of seed money</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>💰</Text>
            </View>
          </>
        )}
      </View>

      {/* Join Button */}
      <TouchableOpacity
        style={[styles.joinButton, submitting && styles.joinButtonDisabled]}
        onPress={handleJoin}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.joinButtonText}>
            {groupGoal
              ? (isIndividualMode 
                ? `Create Goal & Join with ${formatCentsToDollars(contributionCents)}`
                : `Join Group with ${formatCentsToDollars(contributionCents)}`)
              : (isCreator
                ? `Add ${formatCentsToDollars(contributionCents)} Support`
                : contributionCents > 0 
                  ? `Join with ${formatCentsToDollars(contributionCents)}`
                  : 'Join for Free')}
          </Text>
        )}
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  goalCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  goalDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 16,
  },
  goalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  balanceCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  addFundsLink: {
    padding: 8,
  },
  addFundsText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  currencySymbol: {
    color: '#9CA3AF',
    fontSize: 24,
    fontWeight: '600',
    paddingLeft: 16,
  },
  amountInput: {
    flex: 1,
    padding: 16,
    color: '#F9FAFB',
    fontSize: 24,
    fontWeight: '600',
  },
  helperText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  quickAmountButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  quickAmountText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  quickAmountTextActive: {
    color: '#FFFFFF',
  },
  summary: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D1D5DB',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  joinButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.7,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  creatorInfo: {
    backgroundColor: '#1E3A5F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  creatorInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#93C5FD',
    marginBottom: 8,
  },
  creatorInfoText: {
    fontSize: 14,
    color: '#BFDBFE',
    lineHeight: 20,
  },
  // Group goal styles
  groupHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupBadge: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  groupBadgeText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
  },
  // Individual goal form styles
  individualGoalForm: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    color: '#F9FAFB',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default JoinGoalScreen;

