import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  LayoutAnimation,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Goal } from '../../types';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { Theme } from '../../theme';
import { goalsApi, paymentsApi } from '../../services/api';
import { formatCentsToDollars, getDeadlineStatus, getStatusColor } from '../../utils/formatters';
import JoinByCodeModal from '../../components/JoinByCodeModal';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [participatingGoals, setParticipatingGoals] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinByCodeModalVisible, setJoinByCodeModalVisible] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const toggleCategories = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCategories(!showCategories);
  };

  const selectCategory = (goalType: 'self' | 'gift' | 'group') => {
    setShowCategories(false);
    navigation.navigate('CreateGoal', { goalType });
  };

  const loadData = async () => {
    try {
      const [walletData, goalsData] = await Promise.all([
        paymentsApi.getWalletBalance(),
        goalsApi.getAll(),
      ]);
      
      setWalletBalance(walletData.balanceCents);
      
      if (goalsData.createdGoals) {
        setActiveGoals(goalsData.createdGoals.filter(g => g.status === 'active'));
      }
      if (goalsData.participatingGoals) {
        setParticipatingGoals(goalsData.participatingGoals.filter(g => g.status === 'active'));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshUser();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await refreshUser();
    setRefreshing(false);
  };

  const renderGoalCard = (goal: Goal, isParticipating: boolean = false) => (
    <TouchableOpacity
      key={goal._id}
      style={styles.goalCard}
      onPress={() => navigation.navigate('GoalDetail', { goalId: goal._id })}
    >
      <View style={styles.goalHeader}>
        <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(goal.status) }]}>
          <Text style={styles.statusText}>{goal.status}</Text>
        </View>
      </View>
      <Text style={styles.goalDescription} numberOfLines={2}>{goal.description}</Text>
      <View style={styles.goalFooter}>
        <View style={styles.goalStat}>
          <Text style={styles.goalStatLabel}>Total Pot</Text>
          <Text style={styles.goalStatValue}>{formatCentsToDollars(goal.totalPot)}</Text>
        </View>
        <View style={styles.goalStat}>
          <Text style={styles.goalStatLabel}>Deadline</Text>
          <Text style={styles.goalStatValue}>{getDeadlineStatus(goal.deadline)}</Text>
        </View>
        {isParticipating && (
          <View style={styles.goalStat}>
            <Text style={styles.goalStatLabel}>My Stake</Text>
            <Text style={styles.goalStatValue}>
              {formatCentsToDollars((goal as any).myContribution || 0)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}!</Text>
        <Text style={styles.subtitle}>Let's achieve your goals today</Text>
      </View>

      {/* Wallet Card */}
      <View style={styles.walletCard}>
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletBalance}>{formatCentsToDollars(walletBalance)}</Text>
        </View>
        <View style={styles.walletActions}>
          <TouchableOpacity
            style={styles.walletButton}
            onPress={() => navigation.navigate('AddFunds')}
          >
            <Text style={styles.walletButtonText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.walletButton, styles.walletButtonOutline]}
            onPress={() => navigation.navigate('Withdraw')}
          >
            <Text style={[styles.walletButtonText, styles.walletButtonTextOutline]}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionCard, showCategories && styles.actionCardActive]}
          onPress={toggleCategories}
        >
          <Text style={styles.actionIcon}>🎯</Text>
          <Text style={styles.actionText}>Create Goal</Text>
          <Text style={styles.actionToggleIcon}>{showCategories ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => setJoinByCodeModalVisible(true)}
        >
          <Text style={styles.actionIcon}>🔗</Text>
          <Text style={styles.actionText}>Join by Code</Text>
        </TouchableOpacity>
      </View>

      {/* Category Selection */}
      {showCategories && (
        <View style={styles.categorySection}>
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => selectCategory('self')}
          >
            <Text style={styles.categoryButtonMainText}>For Self</Text>
            <Text style={styles.categoryButtonSubText}>with others as participant</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => selectCategory('gift')}
          >
            <Text style={styles.categoryButtonMainText}>For a family member or friend</Text>
            <Text style={styles.categoryButtonSubText}>with yourself and others as participant</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => selectCategory('group')}
          >
            <Text style={styles.categoryButtonMainText}>As a group</Text>
            <Text style={styles.categoryButtonSubText}>all members will be goal seeker</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryButton, styles.categoryButtonAI]}
            onPress={() => {
              setShowCategories(false);
              navigation.navigate('AIGoalCreation');
            }}
          >
            <Text style={styles.categoryButtonMainText}>🤖 I'm not sure. I need help to create a goal</Text>
            <Text style={styles.categoryButtonSubText}>Let AI guide you through the process</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* My Active Goals */}
      {activeGoals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Active Goals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'MyGoals' } as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {activeGoals.slice(0, 3).map(goal => renderGoalCard(goal))}
        </View>
      )}

      {/* Participating Goals */}
      {participatingGoals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Goals I'm Supporting</Text>
          </View>
          {participatingGoals.slice(0, 3).map(goal => renderGoalCard(goal, true))}
        </View>
      )}

      {/* Empty State */}
      {activeGoals.length === 0 && participatingGoals.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>No Active Goals</Text>
          <Text style={styles.emptyText}>
            Create your first goal or join someone else's goal to get started!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('CreateGoal')}
          >
            <Text style={styles.emptyButtonText}>Create Your First Goal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Join by Code Modal */}
      <JoinByCodeModal
        visible={joinByCodeModalVisible}
        onClose={() => setJoinByCodeModalVisible(false)}
        navigation={navigation}
      />
    </ScrollView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontFamily: theme.isDark ? 'Inter-Bold' : 'Inter-SemiBold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
  },
  walletCard: {
    backgroundColor: theme.colors.walletGradientStart,
    borderRadius: theme.borderRadius.card,
    padding: 24,
    marginBottom: 24,
    ...theme.shadows.cardElevated,
  },
  walletInfo: {
    marginBottom: 20,
  },
  walletLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.isDark ? '#C7D2FE' : 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  walletBalance: {
    fontSize: 36,
    fontFamily: theme.isDark ? 'JetBrainsMono-Bold' : 'Inter-Bold',
    color: '#FFFFFF',
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
  },
  walletButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.button,
    padding: 14,
    alignItems: 'center',
  },
  walletButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  walletButtonText: {
    color: theme.colors.walletGradientStart,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  walletButtonTextOutline: {
    color: '#FFFFFF',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 20,
    alignItems: 'center',
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  actionCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.isDark ? theme.colors.infoBg : theme.colors.surface,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  actionToggleIcon: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
  },
  seeAll: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  goalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 16,
    marginBottom: 12,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.badge,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
  },
  goalDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalStat: {
    alignItems: 'center',
  },
  goalStatLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  goalStatValue: {
    fontSize: 14,
    fontFamily: theme.isDark ? 'JetBrainsMono-Regular' : 'Inter-SemiBold',
    color: theme.colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.button,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  categorySection: {
    marginBottom: 24,
    gap: 12,
  },
  categoryButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.button,
    padding: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  categoryButtonMainText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  categoryButtonSubText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  categoryButtonAI: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.isDark ? theme.colors.infoBg : theme.colors.surface,
  },
});

export default HomeScreen;
