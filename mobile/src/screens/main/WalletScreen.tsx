import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Transaction } from '../../types';
import { useTheme } from '../../store/ThemeContext';
import { Theme } from '../../theme';
import { paymentsApi } from '../../services/api';
import { formatCentsToDollars, formatDateTime, getTransactionTypeLabel } from '../../utils/formatters';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
};

const WalletScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [walletData, transactionsData] = await Promise.all([
        paymentsApi.getWalletBalance(),
        paymentsApi.getTransactions({ limit: 50 }),
      ]);
      
      setBalance(walletData.balanceCents);
      setTransactions(transactionsData.transactions);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getTransactionIcon = (type: string, direction: string): string => {
    switch (type) {
      case 'deposit':
        return '💳';
      case 'withdrawal':
        return '🏦';
      case 'goal_contribution':
        return '🎯';
      case 'goal_payout':
        return '🏆';
      case 'refund':
        return '↩️';
      case 'platform_fee':
        return '💼';
      default:
        return direction === 'credit' ? '⬇️' : '⬆️';
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.direction === 'credit';
    
    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionIcon}>
          <Text style={styles.transactionIconText}>
            {getTransactionIcon(item.type, item.direction)}
          </Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionType}>
            {getTransactionTypeLabel(item.type)}
          </Text>
          <Text style={styles.transactionDate}>
            {formatDateTime(item.createdAt)}
          </Text>
          {item.description && (
            <Text style={styles.transactionDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            isCredit ? styles.amountCredit : styles.amountDebit
          ]}>
            {isCredit ? '+' : '-'}{formatCentsToDollars(item.amount)}
          </Text>
          <Text style={[
            styles.statusBadge,
            item.status === 'completed' && styles.statusCompleted,
            item.status === 'pending' && styles.statusPending,
            item.status === 'failed' && styles.statusFailed,
          ]}>
            {item.status}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📜</Text>
      <Text style={styles.emptyTitle}>No Transactions Yet</Text>
      <Text style={styles.emptyText}>
        Add funds to your wallet to start creating and joining goals!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>{formatCentsToDollars(balance)}</Text>
        <View style={styles.balanceActions}>
          <TouchableOpacity
            style={styles.balanceButton}
            onPress={() => navigation.navigate('AddFunds')}
          >
            <Text style={styles.balanceButtonIcon}>+</Text>
            <Text style={styles.balanceButtonText}>Add Funds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.balanceButton, styles.balanceButtonOutline]}
            onPress={() => navigation.navigate('Withdraw')}
          >
            <Text style={[styles.balanceButtonIcon, styles.balanceButtonIconOutline]}>↑</Text>
            <Text style={[styles.balanceButtonText, styles.balanceButtonTextOutline]}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>💡</Text>
        <Text style={styles.infoText}>
          Internal transfers between goals are free! Only external deposits and withdrawals incur Stripe processing fees (~2.9%).
        </Text>
      </View>

      {/* Transactions */}
      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsTitle}>Recent Transactions</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: theme.isDark ? 'Inter-Bold' : 'Inter-SemiBold',
    color: theme.colors.textPrimary,
  },
  balanceCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: theme.borderRadius.card,
    padding: 24,
    marginBottom: 16,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 40,
    fontFamily: theme.isDark ? 'JetBrainsMono-Bold' : 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 24,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.button,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  balanceButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  balanceButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  balanceButtonIconOutline: {
    color: theme.colors.primary,
  },
  balanceButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  balanceButtonTextOutline: {
    color: theme.colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.infoBg,
    marginHorizontal: 20,
    borderRadius: theme.borderRadius.button,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    lineHeight: 18,
  },
  transactionsHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  transactionsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.button,
    padding: 16,
    marginBottom: 8,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionIconText: {
    fontSize: 20,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textMuted,
  },
  transactionDescription: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontFamily: theme.isDark ? 'JetBrainsMono-Bold' : 'Inter-Bold',
    marginBottom: 4,
  },
  amountCredit: {
    color: theme.colors.success,
  },
  amountDebit: {
    color: theme.colors.danger,
  },
  statusBadge: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusCompleted: {
    backgroundColor: theme.colors.successBg,
    color: theme.isDark ? '#6EE7B7' : theme.colors.success,
  },
  statusPending: {
    backgroundColor: theme.colors.warningBg,
    color: theme.isDark ? '#FCD34D' : theme.colors.secondary,
  },
  statusFailed: {
    backgroundColor: theme.colors.errorBg,
    color: theme.isDark ? '#FCA5A5' : theme.colors.danger,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    lineHeight: 20,
    paddingHorizontal: 32,
  },
});

export default WalletScreen;
