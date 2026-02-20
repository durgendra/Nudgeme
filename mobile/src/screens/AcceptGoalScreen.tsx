import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Goal, User, RecurringSeriesInfo } from '../types';
import { goalsApi } from '../services/api';
import { formatCentsToDollars, formatDate } from '../utils/formatters';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AcceptGoal'>;
  route: RouteProp<RootStackParamList, 'AcceptGoal'>;
};

const AcceptGoalScreen: React.FC<Props> = ({ navigation, route }) => {
  const { goalId, shareCode } = route.params;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [canAccept, setCanAccept] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [recurringSeriesInfo, setRecurringSeriesInfo] = useState<RecurringSeriesInfo | null>(null);

  const goalIdentifier = goalId || shareCode || '';

  useEffect(() => {
    if (goalIdentifier) {
      loadGoal();
    } else {
      Alert.alert('Error', 'No goal ID or share code provided');
      navigation.goBack();
    }
  }, [goalIdentifier]);

  const loadGoal = async () => {
    try {
      const data = await goalsApi.getById(goalIdentifier);
      setGoal(data.goal);
      setCanAccept(data.canAccept);
      setRecurringSeriesInfo(data.recurringSeriesInfo || null);
      
      // If goal is not pending acceptance, redirect to detail page
      if (data.goal.status !== 'pending_acceptance') {
        Alert.alert(
          'Goal Already Accepted',
          'This goal has already been accepted.',
          [
            {
              text: 'View Goal',
              onPress: () => navigation.replace('GoalDetail', { goalId: data.goal._id }),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load goal details. Please check the share code and try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (acceptAll: boolean = false) => {
    if (!goal) return;

    setAccepting(true);
    try {
      const identifier = goalId || shareCode || goal._id;
      const result = await goalsApi.accept(identifier, acceptAll);
      
      const message = acceptAll && result.totalAccepted && result.totalAccepted > 1
        ? `You've accepted ${result.totalAccepted} recurring goals! Time to get to work on the first one.`
        : `You've accepted the goal "${goal.title}". Time to get to work! Submit proof before the deadline to win the pot.`;
      
      Alert.alert(
        acceptAll ? 'Goals Accepted! 🔄' : 'Goal Accepted! 🎯',
        message,
        [
          {
            text: 'View Goal',
            onPress: () => navigation.replace('GoalDetail', { goalId: goal._id }),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to accept goal');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!goal) {
    return null;
  }

  const creator = goal.creatorId as User;
  const PLATFORM_FEE = 5;
  const estimatedFee = Math.round(goal.totalPot * (PLATFORM_FEE / 100));
  const estimatedPayout = goal.totalPot - estimatedFee;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Invitation Header */}
      <View style={styles.invitationHeader}>
        <Text style={styles.invitationEmoji}>🎁</Text>
        <Text style={styles.invitationTitle}>You've Been Challenged!</Text>
        <Text style={styles.invitationSubtitle}>
          {creator?.name || 'Someone'} created a goal for you
        </Text>
      </View>

      {/* Goal Details */}
      <View style={styles.goalCard}>
        <Text style={styles.goalTitle}>{goal.title}</Text>
        <Text style={styles.goalDescription}>{goal.description}</Text>
        
        <View style={styles.goalStats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Seed Money</Text>
            <Text style={styles.statValue}>{formatCentsToDollars(goal.seedAmount)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Deadline</Text>
            <Text style={styles.statValue}>{formatDate(goal.deadline)}</Text>
          </View>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How This Works</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>1</Text>
          <Text style={styles.infoText}>Accept this goal to become the Goal Seeker</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>2</Text>
          <Text style={styles.infoText}>Complete the goal before the deadline</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>3</Text>
          <Text style={styles.infoText}>Submit proof of completion</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>4</Text>
          <Text style={styles.infoText}>Win the pot if verified!</Text>
        </View>
      </View>

      {/* Payout Info */}
      <View style={styles.payoutCard}>
        <Text style={styles.payoutTitle}>If You Succeed</Text>
        <View style={styles.payoutRow}>
          <Text style={styles.payoutLabel}>Current pot</Text>
          <Text style={styles.payoutValue}>{formatCentsToDollars(goal.totalPot)}</Text>
        </View>
        <View style={styles.payoutRow}>
          <Text style={styles.payoutLabel}>Platform fee ({PLATFORM_FEE}%)</Text>
          <Text style={[styles.payoutValue, { color: '#EF4444' }]}>
            -{formatCentsToDollars(estimatedFee)}
          </Text>
        </View>
        <View style={[styles.payoutRow, styles.payoutTotal]}>
          <Text style={styles.payoutTotalLabel}>You receive</Text>
          <Text style={styles.payoutTotalValue}>{formatCentsToDollars(estimatedPayout)}</Text>
        </View>
        <Text style={styles.payoutNote}>
          *Pot may increase if more supporters join!
        </Text>
      </View>

      {/* Failure Info */}
      <View style={styles.failureCard}>
        <Text style={styles.failureTitle}>If You Don't Complete</Text>
        <Text style={styles.failureText}>
          • The seed money goes to supporters{'\n'}
          • You don't lose any of your own money
        </Text>
      </View>

      {/* Recurring Goal Info */}
      {goal.isRecurring && recurringSeriesInfo && (
        <View style={styles.recurringCard}>
          <Text style={styles.recurringTitle}>🔄 Recurring Goal</Text>
          <Text style={styles.recurringText}>
            This is a {goal.recurrencePattern} goal with {recurringSeriesInfo.totalGoals} total occurrences.
            {'\n'}Repeats until {formatDate(recurringSeriesInfo.endDate)}.
          </Text>
        </View>
      )}

      {/* Accept/Error Message */}
      {!canAccept && goal.status === 'pending_acceptance' && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            This goal was created for a specific person. You cannot accept it.
          </Text>
        </View>
      )}

      {/* Accept Button(s) */}
      {canAccept && goal.status === 'pending_acceptance' && (
        <>
          {/* Accept All button for recurring goals */}
          {goal.isRecurring && recurringSeriesInfo && recurringSeriesInfo.totalGoals > 1 && (
            <TouchableOpacity
              style={[styles.acceptAllButton, accepting && styles.acceptButtonDisabled]}
              onPress={() => handleAccept(true)}
              disabled={accepting}
            >
              {accepting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptButtonText}>
                  Accept All {recurringSeriesInfo.totalGoals} Goals
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* Accept single goal button */}
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
            onPress={() => handleAccept(false)}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>
                {goal.isRecurring && recurringSeriesInfo && recurringSeriesInfo.totalGoals > 1 
                  ? 'Accept This Goal Only' 
                  : 'Accept Challenge'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Decline Button */}
      {canAccept && goal.status === 'pending_acceptance' && (
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.declineButtonText}>Not Now</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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
  invitationHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  invitationEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  invitationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  invitationSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
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
    marginBottom: 12,
  },
  goalDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 20,
  },
  goalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 16,
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
  infoCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
  },
  payoutCard: {
    backgroundColor: '#064E3B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  payoutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 16,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  payoutLabel: {
    fontSize: 14,
    color: '#A7F3D0',
  },
  payoutValue: {
    fontSize: 14,
    color: '#F9FAFB',
  },
  payoutTotal: {
    borderTopWidth: 1,
    borderTopColor: '#10B981',
    paddingTop: 12,
    marginTop: 8,
  },
  payoutTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  payoutTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  payoutNote: {
    fontSize: 11,
    color: '#6EE7B7',
    marginTop: 12,
    fontStyle: 'italic',
  },
  failureCard: {
    backgroundColor: '#7F1D1D',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  failureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FCA5A5',
    marginBottom: 12,
  },
  failureText: {
    fontSize: 13,
    color: '#FECACA',
    lineHeight: 20,
  },
  errorCard: {
    backgroundColor: '#7F1D1D',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FECACA',
    textAlign: 'center',
  },
  acceptButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptButtonDisabled: {
    opacity: 0.7,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  declineButton: {
    padding: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  recurringCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  recurringTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#93C5FD',
    marginBottom: 8,
  },
  recurringText: {
    fontSize: 14,
    color: '#BFDBFE',
    lineHeight: 20,
  },
  acceptAllButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
});

export default AcceptGoalScreen;

