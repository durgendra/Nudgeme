import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { paymentsApi } from "../services/api";
import { formatCentsToDollars } from "../utils/formatters";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "AddFunds">;
};

const AddFundsScreen: React.FC<Props> = ({ navigation }) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddFunds = async () => {
    const amountCents = Math.round(parseFloat(amount) * 100);

    if (isNaN(amountCents) || amountCents < 100) {
      Alert.alert("Invalid Amount", "Minimum deposit is $1.00");
      return;
    }

    setLoading(true);
    try {
      const response = await paymentsApi.addFunds(amountCents);

      // Check if backend is in development mode (funds added directly)
      if (response.devMode) {
        Alert.alert(
          "✅ Funds Added (Dev Mode)",
          `${formatCentsToDollars(
            amountCents
          )} has been added to your wallet.\n\nNew balance: ${
            response.newBalanceDollars
          }`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Production mode: Process Stripe payment
      const { clientSecret, paymentIntentId } = response;

      // In a real app, you would use Stripe's confirmPayment here
      // For now, we'll show a placeholder message
      Alert.alert(
        "Payment Setup",
        `Payment intent created for ${formatCentsToDollars(
          amountCents
        )}.\n\nIn production, this would open the Stripe payment sheet.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );

      // TODO: Implement actual Stripe payment confirmation
      // const { error } = await confirmPayment(clientSecret, {
      //   paymentMethodType: 'Card',
      // });
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to process payment"
      );
    } finally {
      setLoading(false);
    }
  };

  const amountCents = Math.round((parseFloat(amount) || 0) * 100);
  const stripeFee = Math.round(amountCents * 0.029) + 30; // ~2.9% + $0.30
  const totalCharge = amountCents + stripeFee;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>💳</Text>
        <Text style={styles.headerTitle}>Add Funds</Text>
        <Text style={styles.headerSubtitle}>
          Add money to your wallet to create and join goals
        </Text>
      </View>

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Amount (USD)</Text>
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

      {/* Quick Amount Buttons */}
      <View style={styles.quickAmounts}>
        {["10", "25", "50", "100"].map((amt) => (
          <TouchableOpacity
            key={amt}
            style={[
              styles.quickAmountButton,
              amount === amt && styles.quickAmountButtonActive,
            ]}
            onPress={() => setAmount(amt)}
          >
            <Text
              style={[
                styles.quickAmountText,
                amount === amt && styles.quickAmountTextActive,
              ]}
            >
              ${amt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fee Breakdown */}
      {amountCents > 0 && (
        <View style={styles.feeBreakdown}>
          <Text style={styles.feeTitle}>Payment Details</Text>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Amount to wallet</Text>
            <Text style={styles.feeValue}>
              {formatCentsToDollars(amountCents)}
            </Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>
              Stripe processing fee (~2.9% + $0.30)
            </Text>
            <Text style={[styles.feeValue, { color: "#9CA3AF" }]}>
              ~{formatCentsToDollars(stripeFee)}
            </Text>
          </View>
          <View style={[styles.feeRow, styles.feeTotal]}>
            <Text style={styles.feeTotalLabel}>Total charge</Text>
            <Text style={styles.feeTotalValue}>
              ~{formatCentsToDollars(totalCharge)}
            </Text>
          </View>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          Funds are held securely in your StakeUp wallet. You can withdraw
          anytime. Internal transfers between goals are free!
        </Text>
      </View>

      {/* Add Funds Button */}
      <TouchableOpacity
        style={[
          styles.addButton,
          (loading || amountCents < 100) && styles.addButtonDisabled,
        ]}
        onPress={handleAddFunds}
        disabled={loading || amountCents < 100}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.addButtonText}>
            {amountCents >= 100
              ? `Add ${formatCentsToDollars(amountCents)} to Wallet`
              : "Enter amount (min $1)"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Accepted Cards */}
      <View style={styles.acceptedCards}>
        <Text style={styles.acceptedCardsLabel}>Accepted payment methods</Text>
        <Text style={styles.acceptedCardsIcons}>
          💳 Visa, Mastercard, Amex, Discover
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  currencySymbol: {
    color: "#9CA3AF",
    fontSize: 32,
    fontWeight: "600",
    paddingLeft: 20,
  },
  amountInput: {
    flex: 1,
    padding: 20,
    color: "#F9FAFB",
    fontSize: 32,
    fontWeight: "700",
  },
  quickAmounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  quickAmountButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  quickAmountText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "700",
  },
  quickAmountTextActive: {
    color: "#FFFFFF",
  },
  feeBreakdown: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#374151",
  },
  feeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D1D5DB",
    marginBottom: 16,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    flex: 1,
  },
  feeValue: {
    fontSize: 14,
    color: "#F9FAFB",
  },
  feeTotal: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 12,
    marginTop: 8,
  },
  feeTotalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  feeTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#1E3A5F",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "flex-start",
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#93C5FD",
    lineHeight: 18,
  },
  addButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginBottom: 24,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  acceptedCards: {
    alignItems: "center",
  },
  acceptedCardsLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  acceptedCardsIcons: {
    fontSize: 14,
    color: "#9CA3AF",
  },
});

export default AddFundsScreen;
