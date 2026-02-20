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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { paymentsApi } from '../services/api';
import { formatCentsToDollars } from '../utils/formatters';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Withdraw'>;
};

const WithdrawScreen: React.FC<Props> = ({ navigation }) => {
  const [amount, setAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const data = await paymentsApi.getWalletBalance();
      setWalletBalance(data.balanceCents);
    } catch (error) {
      console.error('Failed to load balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleWithdraw = async () => {
    const amountCents = Math.round(parseFloat(amount) * 100);
    
    if (isNaN(amountCents) || amountCents < 100) {
      Alert.alert('Invalid Amount', 'Minimum withdrawal is $1.00');
      return;
    }

    if (amountCents > walletBalance) {
      Alert.alert('Insufficient Balance', `You only have ${formatCentsToDollars(walletBalance)} available`);
      return;
    }

    setLoading(true);
    try {
      await paymentsApi.withdraw(amountCents);
      
      Alert.alert(
        'Withdrawal Requested',
        `Your withdrawal of ${formatCentsToDollars(amountCents)} has been submitted. It will be processed within 2-3 business days.`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to process withdrawal'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawAll = () => {
    setAmount((walletBalance / 100).toFixed(2));
  };

  const amountCents = Math.round((parseFloat(amount) || 0) * 100);
  const stripeFee = Math.round(amountCents * 0.029) + 30; // ~2.9% + $0.30
  const netAmount = Math.max(0, amountCents - stripeFee);

  if (loadingBalance) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🏦</Text>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <Text style={styles.headerSubtitle}>
          Transfer money from your wallet to your bank account
        </Text>
      </View>

      {/* Available Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>{formatCentsToDollars(walletBalance)}</Text>
        <TouchableOpacity style={styles.withdrawAllButton} onPress={handleWithdrawAll}>
          <Text style={styles.withdrawAllText}>Withdraw All</Text>
        </TouchableOpacity>
      </View>

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Withdrawal Amount (USD)</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor="#6B7280"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Fee Breakdown */}
      {amountCents > 0 && (
        <View style={styles.feeBreakdown}>
          <Text style={styles.feeTitle}>Withdrawal Details</Text>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Withdrawal amount</Text>
            <Text style={styles.feeValue}>{formatCentsToDollars(amountCents)}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Stripe processing fee (~2.9% + $0.30)</Text>
            <Text style={[styles.feeValue, { color: '#EF4444' }]}>
              -{formatCentsToDollars(stripeFee)}
            </Text>
          </View>
          <View style={[styles.feeRow, styles.feeTotal]}>
            <Text style={styles.feeTotalLabel}>You'll receive</Text>
            <Text style={styles.feeTotalValue}>{formatCentsToDollars(netAmount)}</Text>
          </View>
        </View>
      )}

      {/* Warning */}
      <View style={styles.warningCard}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          Withdrawals are processed within 2-3 business days. Make sure you've added a bank account in your Stripe settings.
        </Text>
      </View>

      {/* Withdraw Button */}
      <TouchableOpacity
        style={[
          styles.withdrawButton, 
          (loading || amountCents < 100 || amountCents > walletBalance) && styles.withdrawButtonDisabled
        ]}
        onPress={handleWithdraw}
        disabled={loading || amountCents < 100 || amountCents > walletBalance}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.withdrawButtonText}>
            {amountCents > walletBalance 
              ? 'Insufficient Balance'
              : amountCents >= 100 
                ? `Withdraw ${formatCentsToDollars(amountCents)}`
                : 'Enter amount (min $1)'}
          </Text>
        )}
      </TouchableOpacity>
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 16,
  },
  withdrawAllButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  withdrawAllText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
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
    fontSize: 32,
    fontWeight: '600',
    paddingLeft: 20,
  },
  amountInput: {
    flex: 1,
    padding: 20,
    color: '#F9FAFB',
    fontSize: 32,
    fontWeight: '700',
  },
  feeBreakdown: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  feeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D1D5DB',
    marginBottom: 16,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
  },
  feeValue: {
    fontSize: 14,
    color: '#F9FAFB',
  },
  feeTotal: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 12,
    marginTop: 8,
  },
  feeTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  feeTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#78350F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  warningIcon: {
    fontSize: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#FCD34D',
    lineHeight: 18,
  },
  withdrawButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  withdrawButtonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default WithdrawScreen;

