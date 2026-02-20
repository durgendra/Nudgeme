import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Goal } from "../../types";
import { useTheme } from "../../store/ThemeContext";
import { Theme } from "../../theme";
import { goalsApi } from "../../services/api";
import {
  formatCentsToDollars,
  getDeadlineStatus,
  getStatusColor,
  getVerificationProgressColor,
  getVerificationProgressLabel,
  getVerificationProgressEmoji,
  shouldShowVerificationProgress,
} from "../../utils/formatters";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Main">;
};

type TabType = "created" | "participating";
type FilterType = "all" | "not_started" | "active" | "completed" | "failed";

const MyGoalsScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [activeTab, setActiveTab] = useState<TabType>("created");
  const [filter, setFilter] = useState<FilterType>("all");
  const [createdGoals, setCreatedGoals] = useState<Goal[]>([]);
  const [participatingGoals, setParticipatingGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGoals = async () => {
    try {
      const data = await goalsApi.getAll();
      if (data.createdGoals) setCreatedGoals(data.createdGoals);
      if (data.participatingGoals)
        setParticipatingGoals(data.participatingGoals);
    } catch (error) {
      console.error("Failed to load goals:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  };

  const getFilteredGoals = () => {
    const goals = activeTab === "created" ? createdGoals : participatingGoals;
    if (filter === "all") return goals;
    return goals.filter((g) => g.status === filter);
  };

  const filteredGoals = getFilteredGoals();

  const renderGoalCard = ({ item: goal }: { item: Goal }) => (
    <TouchableOpacity
      style={styles.goalCard}
      onPress={() => navigation.navigate("GoalDetail", { goalId: goal._id })}
    >
      <View style={styles.goalHeader}>
        <View style={styles.goalTitleRow}>
          {goal.isRecurring && <Text style={styles.recurringIcon}>🔄</Text>}
          <Text style={styles.goalTitle} numberOfLines={1}>
            {goal.title}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(goal.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {goal.status.replace("_", " ")}
            </Text>
          </View>
          {shouldShowVerificationProgress(goal.status) &&
            goal.verificationProgress && (
              <View
                style={[
                  styles.progressBadge,
                  {
                    backgroundColor: getVerificationProgressColor(
                      goal.verificationProgress
                    ),
                  },
                ]}
              >
                <Text style={styles.progressText}>
                  {getVerificationProgressEmoji(goal.verificationProgress)}{" "}
                  {getVerificationProgressLabel(goal.verificationProgress)}
                </Text>
              </View>
            )}
        </View>
      </View>

      {/* Recurring indicator */}
      {goal.isRecurring && goal.recurringIndex && (
        <View style={styles.recurringBadge}>
          <Text style={styles.recurringBadgeText}>
            Goal {goal.recurringIndex} • {goal.recurrencePattern}
          </Text>
        </View>
      )}

      <Text style={styles.goalDescription} numberOfLines={2}>
        {goal.description}
      </Text>

      <View style={styles.goalStats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>
            {activeTab === "created" ? "My Seed" : "My Stake"}
          </Text>
          <Text style={styles.statValue}>
            {formatCentsToDollars(
              activeTab === "created"
                ? goal.seedAmount
                : (goal as any).myContribution || 0
            )}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Pot</Text>
          <Text style={styles.statValue}>
            {formatCentsToDollars(goal.totalPot)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Deadline</Text>
          <Text
            style={[
              styles.statValue,
              goal.status === "active" && styles.statValueWarning,
            ]}
          >
            {getDeadlineStatus(goal.deadline)}
          </Text>
        </View>
      </View>

      {goal.status === "active" && activeTab === "created" && (
        <TouchableOpacity
          style={styles.submitProofButton}
          onPress={() =>
            navigation.navigate("VerificationChat", { goalId: goal._id })
          }
        >
          <Text style={styles.submitProofText}>Submit Proof</Text>
        </TouchableOpacity>
      )}

      {(goal.status === "completed" || goal.status === "failed") && (
        <TouchableOpacity
          style={styles.viewHistoryButton}
          onPress={() =>
            navigation.navigate("VerificationChat", { goalId: goal._id })
          }
        >
          <Text style={styles.viewHistoryText}>
            📜 View Verification History
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>
        {activeTab === "created" ? "🎯" : "🤝"}
      </Text>
      <Text style={styles.emptyTitle}>
        {activeTab === "created" ? "No Goals Created" : "No Goals Joined"}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === "created"
          ? "Create your first goal and put some skin in the game!"
          : "Join a friend's goal to support them and earn rewards!"}
      </Text>
      {activeTab === "created" && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate("CreateGoal")}
        >
          <Text style={styles.emptyButtonText}>Create Goal</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Goals</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "created" && styles.tabActive]}
          onPress={() => setActiveTab("created")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "created" && styles.tabTextActive,
            ]}
          >
            Created ({createdGoals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "participating" && styles.tabActive,
          ]}
          onPress={() => setActiveTab("participating")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "participating" && styles.tabTextActive,
            ]}
          >
            Participating ({participatingGoals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(
          [
            "all",
            "not_started",
            "active",
            "completed",
            "failed",
          ] as FilterType[]
        ).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f === "not_started"
                ? "Upcoming"
                : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Goals List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredGoals}
          renderItem={renderGoalCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateGoal")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
      fontFamily: theme.isDark ? "Inter-Bold" : "Inter-SemiBold",
      color: theme.colors.textPrimary,
    },
    tabs: {
      flexDirection: "row",
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.border,
    },
    tabActive: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: theme.colors.textMuted,
    },
    tabTextActive: {
      color: theme.colors.primary,
    },
    filters: {
      flexDirection: "row",
      paddingHorizontal: 20,
      marginBottom: 16,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.chip,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterText: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: theme.colors.textSecondary,
    },
    filterTextActive: {
      color: "#FFFFFF",
    },
    listContent: {
      padding: 20,
      paddingBottom: 100,
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
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    goalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 8,
    },
    recurringIcon: {
      fontSize: 14,
      marginRight: 6,
    },
    goalTitle: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: theme.colors.textPrimary,
      flex: 1,
    },
    recurringBadge: {
      backgroundColor: theme.colors.infoBg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.badge,
      alignSelf: "flex-start",
      marginBottom: 8,
    },
    recurringBadgeText: {
      color: theme.isDark ? "#93C5FD" : theme.colors.info,
      fontSize: 11,
      fontFamily: "Inter-SemiBold",
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.badge,
    },
    statusText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontFamily: "Inter-SemiBold",
      textTransform: "uppercase",
    },
    progressBadge: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.badge,
    },
    progressText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontFamily: "Inter-SemiBold",
    },
    goalDescription: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    goalStats: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    stat: {
      alignItems: "center",
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: theme.colors.textMuted,
      marginBottom: 2,
    },
    statValue: {
      fontSize: 14,
      fontFamily: theme.isDark ? "JetBrainsMono-Regular" : "Inter-SemiBold",
      color: theme.colors.textPrimary,
    },
    statValueWarning: {
      color: theme.colors.secondary,
    },
    submitProofButton: {
      marginTop: 16,
      backgroundColor: theme.colors.success,
      borderRadius: theme.borderRadius.button,
      paddingVertical: 10,
      alignItems: "center",
    },
    submitProofText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
    },
    viewHistoryButton: {
      marginTop: 16,
      backgroundColor: theme.colors.infoBg,
      borderRadius: theme.borderRadius.button,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.info,
    },
    viewHistoryText: {
      color: theme.isDark ? "#93C5FD" : theme.colors.info,
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 48,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontFamily: "Inter-Bold",
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
      paddingHorizontal: 32,
    },
    emptyButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.button,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    emptyButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontFamily: "Inter-Bold",
    },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 20,
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.fab,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      ...theme.shadows.fab,
    },
    fabText: {
      fontSize: 32,
      color: "#FFFFFF",
      fontWeight: "300",
      marginTop: -2,
    },
  });

export default MyGoalsScreen;
