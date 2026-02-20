import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
  TextInput,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import {
  RootStackParamList,
  GoalDetailResponse,
  Participant,
  GroupGoal,
  Goal,
  GoalReminderSettings,
  ReminderFrequency,
} from "../types";
import { goalsApi } from "../services/api";
import {
  formatCentsToDollars,
  formatDate,
  getDeadlineStatus,
  getStatusColor,
  getShareMessage,
  getSuccessShareMessage,
  getVerificationProgressColor,
  getVerificationProgressLabel,
  getVerificationProgressEmoji,
  shouldShowVerificationProgress,
} from "../utils/formatters";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "GoalDetail">;
  route: RouteProp<RootStackParamList, "GoalDetail">;
};

// Edit permissions state type
interface EditPermissions {
  canEditGoal: boolean;
  editGoalReason?: string;
  editGoalDeadline?: string;
  canAdjustAmount: boolean;
  adjustType?: "seed" | "contribution";
  adjustAmountReason?: string;
  canEditGroupGoal: boolean;
  editGroupGoalReason?: string;
  editGroupGoalDeadline?: string;
  currentSeedAmount: number;
  currentContribution: number;
  minAmount: number;
}

const GoalDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { goalId, shareCode, groupGoalId } = route.params;
  const [data, setData] = useState<GoalDetailResponse | null>(null);
  const [groupGoalData, setGroupGoalData] = useState<{
    groupGoal: GroupGoal;
    participantGoals: Goal[];
    participants: any[];
    participantCount: number;
    isGroupCreator: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [reminderSettings, setReminderSettings] =
    useState<GoalReminderSettings | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [isGoalLevelReminder, setIsGoalLevelReminder] = useState(true);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Edit permissions and modals state
  const [editPermissions, setEditPermissions] =
    useState<EditPermissions | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustAmountModal, setShowAdjustAmountModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState(new Date());
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [editVerificationCriteria, setEditVerificationCriteria] = useState("");

  // Adjust amount state
  const [newAmount, setNewAmount] = useState("");

  useEffect(() => {
    loadGoal();
  }, [goalId, shareCode, groupGoalId]);

  const loadReminderSettings = async (goalIdToLoad: string) => {
    try {
      const response = await goalsApi.getReminderSettings(goalIdToLoad);
      setReminderSettings(response.reminderSettings as GoalReminderSettings);
      setIsGoalLevelReminder(response.isGoalLevel);
    } catch (err) {
      console.log("Failed to load reminder settings:", err);
    }
  };

  const loadEditPermissions = async (goalIdToLoad: string) => {
    try {
      const permissions = await goalsApi.getEditPermissions(goalIdToLoad);
      setEditPermissions(permissions);
    } catch (err) {
      console.log("Failed to load edit permissions:", err);
    }
  };

  const handleOpenEditModal = () => {
    if (!data) return;
    // Pre-populate form with current values
    setEditTitle(data.goal.title);
    setEditDescription(data.goal.description || "");
    setEditDeadline(new Date(data.goal.deadline));
    setEditVerificationCriteria(data.goal.verificationCriteria || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!data) return;
    setEditLoading(true);
    try {
      const updates: any = {};
      if (editTitle !== data.goal.title) updates.title = editTitle;
      if (editDescription !== (data.goal.description || ""))
        updates.description = editDescription;
      if (
        editDeadline.toISOString() !==
        new Date(data.goal.deadline).toISOString()
      ) {
        updates.deadline = editDeadline.toISOString();
      }
      if (editVerificationCriteria !== (data.goal.verificationCriteria || "")) {
        updates.verificationCriteria = editVerificationCriteria;
      }

      if (Object.keys(updates).length === 0) {
        setShowEditModal(false);
        return;
      }

      await goalsApi.update(data.goal._id, updates);
      Alert.alert("Success", "Goal updated successfully");
      setShowEditModal(false);
      loadGoal(); // Refresh the goal data
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to update goal"
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenAdjustAmountModal = () => {
    if (!editPermissions) return;
    const currentAmount =
      editPermissions.adjustType === "seed"
        ? editPermissions.currentSeedAmount
        : editPermissions.currentContribution;
    setNewAmount((currentAmount / 100).toFixed(2));
    setShowAdjustAmountModal(true);
  };

  const handleSaveAmount = async () => {
    if (!data || !editPermissions) return;
    const amountInCents = Math.round(parseFloat(newAmount) * 100);

    if (isNaN(amountInCents) || amountInCents < editPermissions.minAmount) {
      Alert.alert(
        "Invalid Amount",
        `Amount must be at least ${(editPermissions.minAmount / 100).toFixed(
          2
        )}`
      );
      return;
    }

    setEditLoading(true);
    try {
      const result = await goalsApi.adjustSeedAmount(
        data.goal._id,
        amountInCents
      );
      Alert.alert(
        "Success",
        `Amount updated from ${(result.oldAmount / 100).toFixed(2)} to ${(
          result.newAmount / 100
        ).toFixed(2)}. New wallet balance: ${(
          result.walletBalance / 100
        ).toFixed(2)}`
      );
      setShowAdjustAmountModal(false);
      loadGoal(); // Refresh the goal data
      loadEditPermissions(data.goal._id); // Refresh permissions
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to adjust amount"
      );
    } finally {
      setEditLoading(false);
    }
  };

  const formatTimeRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diffMs = end.getTime() - now.getTime();

    if (diffMs <= 0) return "Expired";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const updateReminderSetting = async (
    update: Partial<GoalReminderSettings>
  ) => {
    if (!data) return;
    try {
      setReminderLoading(true);
      const response = await goalsApi.updateReminderSettings(
        data.goal._id,
        update
      );
      setReminderSettings(response.reminderSettings);
      setIsGoalLevelReminder(response.isGoalLevel);
    } catch (err) {
      Alert.alert("Error", "Failed to update reminder settings");
    } finally {
      setReminderLoading(false);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "Use default";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getFrequencyLabel = (frequency: ReminderFrequency | null) => {
    switch (frequency) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Auto (based on goal)";
    }
  };

  const timeOptions = [
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
  ];

  const frequencyOptions: Array<{
    value: ReminderFrequency | null;
    label: string;
  }> = [
    { value: null, label: "Auto (based on goal duration)" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  const loadGoal = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load regular goal data
      const result = await goalsApi.getById(goalId || shareCode || "");
      setData(result);

      // Load reminder settings and edit permissions
      if (result.goal._id) {
        loadReminderSettings(result.goal._id);
        loadEditPermissions(result.goal._id);
      }

      // If this goal is part of a GroupGoal or we have a groupGoalId, load group data
      const effectiveGroupGoalId =
        groupGoalId || result.groupGoalInfo?.groupGoal?._id;
      if (effectiveGroupGoalId) {
        try {
          const groupData = await goalsApi.getGroupGoal(effectiveGroupGoalId);
          setGroupGoalData(groupData);
        } catch (e) {
          console.log("Failed to load group goal data:", e);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goal");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!data) return;

    // If recurring goal, show modal with options
    if (data.goal.isRecurring && data.recurringSeriesInfo) {
      setShowShareModal(true);
      return;
    }

    // For group goals, share the group
    if (groupGoalData) {
      try {
        const message = `Join my group "${
          groupGoalData.groupGoal.groupName
        }" on StakeUp! ${
          groupGoalData.groupGoal.goalMode === "individual"
            ? "Set your own goal and compete for the shared pot!"
            : "Work toward our common goal together!"
        } Use code: ${
          groupGoalData.groupGoal.shareCode
        } or tap: stakeup://group/${groupGoalData.groupGoal.shareCode}`;
        await Share.share({ message });
      } catch (error) {
        console.error("Share error:", error);
      }
      return;
    }

    // Non-recurring: share directly
    try {
      await Share.share({
        message: getShareMessage(data.goal),
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleShareSingle = async () => {
    if (!data) return;
    setShowShareModal(false);

    try {
      await Share.share({
        message: getShareMessage(data.goal),
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleShareAll = async () => {
    if (!data || !data.recurringSeriesInfo) return;
    setShowShareModal(false);

    try {
      const message = `Join my recurring goal "${
        data.goal.title
      }" on StakeUp! This is a ${data.goal.recurrencePattern} goal with ${
        data.recurringSeriesInfo.totalGoals
      } occurrences. Total pot: ${formatCentsToDollars(
        data.goal.totalPot
      )}. Use code: ${data.goal.shareCode} or tap the link: stakeup://goal/${
        data.goal.shareCode
      }?acceptAll=true`;

      await Share.share({ message });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleShareSuccess = async () => {
    if (!data) return;

    try {
      await Share.share({
        message: getSuccessShareMessage(data.goal),
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleJoin = () => {
    if (!data) return;
    // If this is part of a group goal, pass the groupGoalId
    const effectiveGroupGoalId =
      groupGoalData?.groupGoal._id || data.groupGoalInfo?.groupGoal?._id;
    if (effectiveGroupGoalId) {
      navigation.navigate("JoinGoal", { groupGoalId: effectiveGroupGoalId });
    } else {
      navigation.navigate("JoinGoal", { goalId: data.goal._id });
    }
  };

  const handleSubmitProof = () => {
    if (!data) return;
    navigation.navigate("VerificationChat", { goalId: data.goal._id });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error || "Goal not found"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadGoal}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {
    goal,
    participants,
    isCreator,
    isSeeker,
    isParticipating,
    needsAcceptance,
    canAccept,
    platformFeePreview,
  } = data;
  const hasSeeker = !!goal.seekerId;
  const isGroupGoal = goal.goalType === "group";

  const handleAccept = () => {
    navigation.navigate("AcceptGoal", { goalId: goal._id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Banner */}
      <View
        style={[
          styles.statusBanner,
          { backgroundColor: getStatusColor(goal.status) },
        ]}
      >
        <View style={styles.statusBannerContent}>
          <Text style={styles.statusText}>
            {goal.status === "not_started" && "⏸️ Not Started"}
            {goal.status === "pending_acceptance" && "📬 Awaiting Acceptance"}
            {goal.status === "active" && "🔥 Active"}
            {goal.status === "completed" && "🎉 Completed"}
            {goal.status === "failed" && "❌ Failed"}
          </Text>
          {shouldShowVerificationProgress(goal.status) &&
            goal.verificationProgress && (
              <View
                style={[
                  styles.verificationProgressBadge,
                  {
                    backgroundColor: getVerificationProgressColor(
                      goal.verificationProgress
                    ),
                  },
                ]}
              >
                <Text style={styles.verificationProgressText}>
                  {getVerificationProgressEmoji(goal.verificationProgress)}{" "}
                  {getVerificationProgressLabel(goal.verificationProgress)}
                </Text>
              </View>
            )}
        </View>
      </View>

      {/* Recurring Series Info */}
      {goal.isRecurring && data.recurringSeriesInfo && (
        <View style={styles.recurringSeriesInfo}>
          <View style={styles.recurringSeriesHeader}>
            <Text style={styles.recurringSeriesTitle}>🔄 Recurring Goal</Text>
            <Text style={styles.recurringSeriesSubtitle}>
              Goal {data.recurringSeriesInfo.currentIndex} of{" "}
              {data.recurringSeriesInfo.totalGoals}
            </Text>
          </View>
          <Text style={styles.recurringSeriesPattern}>
            Repeats {goal.recurrencePattern} until{" "}
            {formatDate(data.recurringSeriesInfo.endDate)}
          </Text>
          <View style={styles.recurringSeriesProgress}>
            {data.recurringSeriesInfo.goals.slice(0, 10).map((g, i) => (
              <View
                key={g._id}
                style={[
                  styles.recurringSeriesDot,
                  { backgroundColor: getStatusColor(g.status) },
                  g._id === goal._id && styles.recurringSeriesDotCurrent,
                ]}
              />
            ))}
            {data.recurringSeriesInfo.totalGoals > 10 && (
              <Text style={styles.recurringSeriesMore}>
                +{data.recurringSeriesInfo.totalGoals - 10}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Goal Info */}
      <View style={styles.section}>
        <Text style={styles.goalTitle}>{goal.title}</Text>
        <Text style={styles.goalDescription}>{goal.description}</Text>

        {goal.verificationCriteria && (
          <View style={styles.criteriaBox}>
            <Text style={styles.criteriaLabel}>Verification Criteria</Text>
            <Text style={styles.criteriaText}>{goal.verificationCriteria}</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatCentsToDollars(goal.totalPot)}
          </Text>
          <Text style={styles.statLabel}>Total Pot</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{participants.length}</Text>
          <Text style={styles.statLabel}>Participants</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#FCD34D" }]}>
            {getDeadlineStatus(goal.deadline)}
          </Text>
          <Text style={styles.statLabel}>Deadline</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatCentsToDollars(goal.seedAmount)}
          </Text>
          <Text style={styles.statLabel}>Seed Money</Text>
        </View>
      </View>

      {/* Goal Type Indicator */}
      {isGroupGoal && (
        <View style={styles.groupGoalBadge}>
          <Text style={styles.groupGoalBadgeText}>👥 Group Goal</Text>
        </View>
      )}

      {/* Group Goal Info Section */}
      {groupGoalData && (
        <View style={styles.groupGoalSection}>
          <View style={styles.groupGoalHeader}>
            <Text style={styles.groupGoalName}>
              {groupGoalData.groupGoal.groupName}
            </Text>
            <View style={styles.groupGoalModeBadge}>
              <Text style={styles.groupGoalModeText}>
                {groupGoalData.groupGoal.goalMode === "common"
                  ? "🎯 Common Goal"
                  : "🎨 Individual Goals"}
              </Text>
            </View>
          </View>

          <View style={styles.groupGoalStats}>
            <View style={styles.groupGoalStat}>
              <Text style={styles.groupGoalStatValue}>
                {formatCentsToDollars(groupGoalData.groupGoal.sharedPot)}
              </Text>
              <Text style={styles.groupGoalStatLabel}>Shared Pot</Text>
            </View>
            <View style={styles.groupGoalStat}>
              <Text style={styles.groupGoalStatValue}>
                {groupGoalData.participantCount}
              </Text>
              <Text style={styles.groupGoalStatLabel}>Participants</Text>
            </View>
          </View>

          {/* Participant Goals (for individual mode) */}
          {groupGoalData.groupGoal.goalMode === "individual" &&
            groupGoalData.participantGoals.length > 0 && (
              <View style={styles.participantGoalsSection}>
                <Text style={styles.participantGoalsTitle}>
                  All Goals in This Group
                </Text>
                {groupGoalData.participantGoals.map((pGoal) => (
                  <View key={pGoal._id} style={styles.participantGoalCard}>
                    <View style={styles.participantGoalHeader}>
                      <Text
                        style={styles.participantGoalTitle}
                        numberOfLines={1}
                      >
                        {pGoal.title}
                      </Text>
                      <View
                        style={[
                          styles.participantGoalStatus,
                          { backgroundColor: getStatusColor(pGoal.status) },
                        ]}
                      >
                        <Text style={styles.participantGoalStatusText}>
                          {pGoal.status === "completed"
                            ? "✓"
                            : pGoal.status === "failed"
                            ? "✗"
                            : "•"}
                        </Text>
                      </View>
                    </View>
                    {pGoal._id === goal._id && (
                      <Text style={styles.participantGoalYou}>(Your Goal)</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
        </View>
      )}

      {/* Platform Fee Info */}
      {(goal.status === "active" || goal.status === "pending_acceptance") && (
        <View style={styles.feeInfo}>
          <Text style={styles.feeTitle}>Payout Breakdown (on success)</Text>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Total Pot</Text>
            <Text style={styles.feeValue}>
              {formatCentsToDollars(goal.totalPot)}
            </Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>
              Platform Fee ({platformFeePreview.percentage}%)
            </Text>
            <Text style={[styles.feeValue, { color: "#EF4444" }]}>
              -{formatCentsToDollars(platformFeePreview.estimatedFee)}
            </Text>
          </View>
          <View style={[styles.feeRow, styles.feeRowTotal]}>
            {isGroupGoal ? (
              <>
                <Text style={styles.feeLabelBold}>
                  Each Successful Participant Receives
                </Text>
                <Text style={styles.feeValueBold}>
                  {participants.length > 0
                    ? formatCentsToDollars(
                        Math.floor(
                          (goal.totalPot - platformFeePreview.estimatedFee) /
                            participants.length
                        )
                      )
                    : formatCentsToDollars(0)}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.feeLabelBold}>
                  {hasSeeker ? "Goal Seeker" : "Creator"} Receives
                </Text>
                <Text style={styles.feeValueBold}>
                  {formatCentsToDollars(
                    platformFeePreview.estimatedSeekerPayout
                  )}
                </Text>
              </>
            )}
          </View>
          {isGroupGoal && (
            <Text style={styles.feeNote}>
              * Pot divided equally among successful participants. If no one
              completes, entire pot is forfeited.
            </Text>
          )}
          {!isGroupGoal && (
            <Text style={styles.feeNote}>
              * Stripe fees (~2.9%) apply on withdrawal
            </Text>
          )}
        </View>
      )}

      {/* Participants */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Participants ({participants.length})
        </Text>
        {participants.length === 0 ? (
          <Text style={styles.noParticipants}>
            No participants yet. Be the first!
          </Text>
        ) : (
          participants.map((p: Participant, index: number) => (
            <View key={index} style={styles.participantCard}>
              <View style={styles.participantAvatar}>
                <Text style={styles.participantAvatarText}>
                  {p.user.name?.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{p.user.name}</Text>
                <Text style={styles.participantDate}>
                  Joined {formatDate(p.joinedAt)}
                </Text>
              </View>
              <Text style={styles.participantContribution}>
                {formatCentsToDollars(p.contribution)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Share Code */}
      {goal.status !== "completed" && goal.status !== "failed" && (
        <View style={styles.shareCodeBox}>
          <Text style={styles.shareCodeLabel}>Share Code</Text>
          <Text style={styles.shareCode}>{goal.shareCode}</Text>
        </View>
      )}

      {/* Reminder Settings Section */}
      {goal.status === "active" &&
        (isCreator || isSeeker || isParticipating) && (
          <TouchableOpacity
            style={styles.reminderSettingsToggle}
            onPress={() => setShowReminderSettings(!showReminderSettings)}
          >
            <View style={styles.reminderSettingsHeader}>
              <Text style={styles.reminderSettingsIcon}>🔔</Text>
              <View style={styles.reminderSettingsInfo}>
                <Text style={styles.reminderSettingsTitle}>
                  Reminder Settings
                </Text>
                <Text style={styles.reminderSettingsSubtitle}>
                  {reminderSettings?.enabled !== false
                    ? "Reminders enabled"
                    : "Reminders disabled"}
                </Text>
              </View>
              <Text style={styles.reminderSettingsArrow}>
                {showReminderSettings ? "▲" : "▼"}
              </Text>
            </View>
          </TouchableOpacity>
        )}

      {showReminderSettings && reminderSettings && (
        <View style={styles.reminderSettingsContent}>
          {/* Enable/Disable Toggle */}
          <View style={styles.reminderSettingRow}>
            <View style={styles.reminderSettingInfo}>
              <Text style={styles.reminderSettingLabel}>Enable Reminders</Text>
              <Text style={styles.reminderSettingDescription}>
                {isGoalLevelReminder
                  ? "Receive progress reminders for this goal"
                  : "Receive reminders as a supporter"}
              </Text>
            </View>
            <Switch
              value={reminderSettings.enabled}
              onValueChange={(value: boolean) =>
                updateReminderSetting({ enabled: value })
              }
              trackColor={{ false: "#374151", true: "#4F46E5" }}
              thumbColor={reminderSettings.enabled ? "#FFFFFF" : "#9CA3AF"}
              disabled={reminderLoading}
            />
          </View>

          {/* Frequency (only for goal-level settings) */}
          {isGoalLevelReminder && (
            <TouchableOpacity
              style={styles.reminderSettingRow}
              onPress={() => setShowFrequencyPicker(true)}
              disabled={!reminderSettings.enabled}
            >
              <View style={styles.reminderSettingInfo}>
                <Text
                  style={[
                    styles.reminderSettingLabel,
                    !reminderSettings.enabled && styles.reminderSettingDisabled,
                  ]}
                >
                  Frequency
                </Text>
                <Text
                  style={[
                    styles.reminderSettingDescription,
                    !reminderSettings.enabled && styles.reminderSettingDisabled,
                  ]}
                >
                  How often to send reminders
                </Text>
              </View>
              <View style={styles.reminderSettingValue}>
                <Text
                  style={[
                    styles.reminderSettingValueText,
                    !reminderSettings.enabled && styles.reminderSettingDisabled,
                  ]}
                >
                  {getFrequencyLabel(reminderSettings.frequency)}
                </Text>
                <Text style={styles.reminderSettingArrow}>›</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Time */}
          <TouchableOpacity
            style={styles.reminderSettingRow}
            onPress={() => setShowTimePicker(true)}
            disabled={!reminderSettings.enabled}
          >
            <View style={styles.reminderSettingInfo}>
              <Text
                style={[
                  styles.reminderSettingLabel,
                  !reminderSettings.enabled && styles.reminderSettingDisabled,
                ]}
              >
                Reminder Time
              </Text>
              <Text
                style={[
                  styles.reminderSettingDescription,
                  !reminderSettings.enabled && styles.reminderSettingDisabled,
                ]}
              >
                When to receive reminders
              </Text>
            </View>
            <View style={styles.reminderSettingValue}>
              <Text
                style={[
                  styles.reminderSettingValueText,
                  !reminderSettings.enabled && styles.reminderSettingDisabled,
                ]}
              >
                {formatTime(reminderSettings.reminderTime)}
              </Text>
              <Text style={styles.reminderSettingArrow}>›</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Pending Acceptance Info */}
      {needsAcceptance && isCreator && (
        <View style={styles.pendingInfo}>
          <Text style={styles.pendingTitle}>⏳ Awaiting Acceptance</Text>
          <Text style={styles.pendingText}>
            Share the goal code or link with the intended recipient. Once they
            accept, the goal will become active.
          </Text>
          {goal.seekerEmail && (
            <Text style={styles.pendingEmail}>Invited: {goal.seekerEmail}</Text>
          )}
        </View>
      )}

      {/* Edit Goal Section */}
      {editPermissions &&
        (editPermissions.canEditGoal || editPermissions.canAdjustAmount) && (
          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>⚙️ Goal Settings</Text>

            {editPermissions.canEditGoal &&
              editPermissions.editGoalDeadline && (
                <View style={styles.editTimeRemaining}>
                  <Text style={styles.editTimeRemainingText}>
                    ⏱️ Edit window:{" "}
                    {formatTimeRemaining(editPermissions.editGoalDeadline)}
                  </Text>
                </View>
              )}

            <View style={styles.editButtons}>
              {editPermissions.canEditGoal && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleOpenEditModal}
                >
                  <Text style={styles.editButtonText}>✏️ Edit Goal</Text>
                </TouchableOpacity>
              )}

              {editPermissions.canAdjustAmount && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleOpenAdjustAmountModal}
                >
                  <Text style={styles.editButtonText}>
                    💰 Adjust{" "}
                    {editPermissions.adjustType === "seed"
                      ? "Seed Money"
                      : "Contribution"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {!editPermissions.canEditGoal && editPermissions.editGoalReason && (
              <Text style={styles.editDisabledReason}>
                {editPermissions.editGoalReason}
              </Text>
            )}
          </View>
        )}

      {/* Actions */}
      <View style={styles.actions}>
        {/* View Verification History for completed/failed goals */}
        {(goal.status === "completed" || goal.status === "failed") && (
          <TouchableOpacity
            style={styles.historyButton}
            onPress={handleSubmitProof}
          >
            <Text style={styles.historyButtonText}>
              📜 View Verification History
            </Text>
          </TouchableOpacity>
        )}

        {/* Share Success button for completed goals */}
        {goal.status === "completed" && (
          <TouchableOpacity
            style={styles.successButton}
            onPress={handleShareSuccess}
          >
            <Text style={styles.successButtonText}>🎉 Share Success</Text>
          </TouchableOpacity>
        )}

        {/* Group goal: Any participant can submit proof */}
        {isGroupGoal && isParticipating && goal.status === "active" && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmitProof}
          >
            <Text style={styles.primaryButtonText}>
              Submit Your Verification
            </Text>
          </TouchableOpacity>
        )}

        {/* Goal Seeker can submit proof */}
        {!isGroupGoal && isSeeker && goal.status === "active" && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmitProof}
          >
            <Text style={styles.primaryButtonText}>Submit Proof</Text>
          </TouchableOpacity>
        )}

        {/* Traditional creator (no seeker) can submit proof */}
        {!isGroupGoal &&
          isCreator &&
          !hasSeeker &&
          goal.status === "active" && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSubmitProof}
            >
              <Text style={styles.primaryButtonText}>Submit Proof</Text>
            </TouchableOpacity>
          )}

        {/* Accept button for pending goals */}
        {canAccept && needsAcceptance && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleAccept}>
            <Text style={styles.primaryButtonText}>Accept Challenge</Text>
          </TouchableOpacity>
        )}

        {/* Creator can join to add more funds (when goal has seeker) */}
        {isCreator && hasSeeker && goal.status === "active" && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleJoin}>
            <Text style={styles.primaryButtonText}>Add More Support</Text>
          </TouchableOpacity>
        )}

        {/* Non-creator, non-seeker can join */}
        {!isCreator &&
          !isSeeker &&
          !isParticipating &&
          goal.status === "active" && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleJoin}>
              <Text style={styles.primaryButtonText}>
                {isGroupGoal ? "Join Group Goal" : "Join Goal"}
              </Text>
            </TouchableOpacity>
          )}

        {/* Group goal: Creator can join to add more funds */}
        {isGroupGoal && isCreator && goal.status === "active" && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleJoin}>
            <Text style={styles.primaryButtonText}>Add More Money</Text>
          </TouchableOpacity>
        )}

        {/* Show participating badge */}
        {isParticipating && !isCreator && !isSeeker && (
          <View style={styles.participatingBadge}>
            <Text style={styles.participatingText}>
              ✓ You're supporting this goal
            </Text>
          </View>
        )}

        {/* Seeker badge */}
        {isSeeker && goal.status === "active" && (
          <View style={styles.seekerBadge}>
            <Text style={styles.seekerText}>🎯 You're the Goal Seeker</Text>
          </View>
        )}

        {/* Creator badge (when there's a seeker) */}
        {isCreator && hasSeeker && isParticipating && (
          <View style={styles.participatingBadge}>
            <Text style={styles.participatingText}>
              ✓ You created this challenge
            </Text>
          </View>
        )}

        {/* Share Goal button - hidden for completed/failed goals */}
        {goal.status !== "completed" && goal.status !== "failed" && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleShare}
          >
            <Text style={styles.secondaryButtonText}>Share Goal</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Share Modal for Recurring Goals */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Recurring Goal</Text>
            <Text style={styles.modalSubtitle}>
              This goal is part of a series of{" "}
              {data?.recurringSeriesInfo?.totalGoals} recurring goals.
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleShareSingle}
            >
              <Text style={styles.modalOptionIcon}>📄</Text>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>
                  Share This Goal Only
                </Text>
                <Text style={styles.modalOptionDescription}>
                  Share just this single occurrence
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleShareAll}
            >
              <Text style={styles.modalOptionIcon}>📚</Text>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Share All Goals</Text>
                <Text style={styles.modalOptionDescription}>
                  Share the entire recurring series
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowShareModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Frequency Picker Modal */}
      <Modal
        visible={showFrequencyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFrequencyPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowFrequencyPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Frequency</Text>
            {frequencyOptions.map((option) => (
              <TouchableOpacity
                key={option.value || "auto"}
                style={[
                  styles.pickerOption,
                  reminderSettings?.frequency === option.value &&
                    styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  updateReminderSetting({ frequency: option.value });
                  setShowFrequencyPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    reminderSettings?.frequency === option.value &&
                      styles.pickerOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {reminderSettings?.frequency === option.value && (
                  <Text style={styles.pickerCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowTimePicker(false)}
        >
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Time</Text>
            <TouchableOpacity
              style={[
                styles.pickerOption,
                reminderSettings?.reminderTime === null &&
                  styles.pickerOptionSelected,
              ]}
              onPress={() => {
                updateReminderSetting({ reminderTime: null });
                setShowTimePicker(false);
              }}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  reminderSettings?.reminderTime === null &&
                    styles.pickerOptionTextSelected,
                ]}
              >
                Use default
              </Text>
              {reminderSettings?.reminderTime === null && (
                <Text style={styles.pickerCheck}>✓</Text>
              )}
            </TouchableOpacity>
            <ScrollView style={styles.timeScrollView}>
              {timeOptions.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.pickerOption,
                    reminderSettings?.reminderTime === time &&
                      styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    updateReminderSetting({ reminderTime: time });
                    setShowTimePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      reminderSettings?.reminderTime === time &&
                        styles.pickerOptionTextSelected,
                    ]}
                  >
                    {formatTime(time)}
                  </Text>
                  {reminderSettings?.reminderTime === time && (
                    <Text style={styles.pickerCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Goal Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Goal</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={styles.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalScroll}>
              {/* Title */}
              <View style={styles.editFormGroup}>
                <Text style={styles.editFormLabel}>Title</Text>
                <TextInput
                  style={styles.editFormInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Goal title"
                  placeholderTextColor="#6B7280"
                  maxLength={200}
                />
              </View>

              {/* Description */}
              <View style={styles.editFormGroup}>
                <Text style={styles.editFormLabel}>Description</Text>
                <TextInput
                  style={[styles.editFormInput, styles.editFormTextArea]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Goal description"
                  placeholderTextColor="#6B7280"
                  multiline
                  numberOfLines={4}
                  maxLength={2000}
                />
              </View>

              {/* Deadline - Read-only display since date picker is complex */}
              <View style={styles.editFormGroup}>
                <Text style={styles.editFormLabel}>Deadline</Text>
                <View style={styles.editFormDateButton}>
                  <Text style={styles.editFormDateText}>
                    {editDeadline.toLocaleDateString()}{" "}
                    {editDeadline.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text style={styles.editFormDateNote}>
                    (Date changes not supported in this version)
                  </Text>
                </View>
              </View>

              {/* Verification Criteria */}
              <View style={styles.editFormGroup}>
                <Text style={styles.editFormLabel}>Verification Criteria</Text>
                <TextInput
                  style={[styles.editFormInput, styles.editFormTextArea]}
                  value={editVerificationCriteria}
                  onChangeText={setEditVerificationCriteria}
                  placeholder="How will you prove completion?"
                  placeholderTextColor="#6B7280"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>
            </ScrollView>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={styles.editModalCancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.editModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editModalSaveButton,
                  editLoading && styles.editModalButtonDisabled,
                ]}
                onPress={handleSaveEdit}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editModalSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Adjust Amount Modal */}
      <Modal
        visible={showAdjustAmountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdjustAmountModal(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={[styles.editModalContent, { maxHeight: 350 }]}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>
                Adjust{" "}
                {editPermissions?.adjustType === "seed"
                  ? "Seed Money"
                  : "Contribution"}
              </Text>
              <TouchableOpacity onPress={() => setShowAdjustAmountModal(false)}>
                <Text style={styles.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.adjustAmountContainer}>
              <Text style={styles.adjustAmountLabel}>
                Current: $
                {editPermissions
                  ? editPermissions.adjustType === "seed"
                    ? (editPermissions.currentSeedAmount / 100).toFixed(2)
                    : (editPermissions.currentContribution / 100).toFixed(2)
                  : "0.00"}
              </Text>

              <View style={styles.adjustAmountInputContainer}>
                <Text style={styles.adjustAmountCurrency}>$</Text>
                <TextInput
                  style={styles.adjustAmountInput}
                  value={newAmount}
                  onChangeText={setNewAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <Text style={styles.adjustAmountNote}>
                Minimum: $
                {editPermissions
                  ? (editPermissions.minAmount / 100).toFixed(2)
                  : "1.00"}
              </Text>
              <Text style={styles.adjustAmountNote}>
                {parseFloat(newAmount) * 100 >
                (editPermissions?.adjustType === "seed"
                  ? editPermissions?.currentSeedAmount || 0
                  : editPermissions?.currentContribution || 0)
                  ? "Difference will be deducted from your wallet"
                  : "Difference will be refunded to your wallet"}
              </Text>
            </View>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={styles.editModalCancelButton}
                onPress={() => setShowAdjustAmountModal(false)}
              >
                <Text style={styles.editModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editModalSaveButton,
                  editLoading && styles.editModalButtonDisabled,
                ]}
                onPress={handleSaveAmount}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editModalSaveText}>Update Amount</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  statusBanner: {
    padding: 12,
    alignItems: "center",
  },
  statusBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  verificationProgressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verificationProgressText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    padding: 20,
  },
  goalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 12,
  },
  goalDescription: {
    fontSize: 16,
    color: "#9CA3AF",
    lineHeight: 24,
  },
  criteriaBox: {
    marginTop: 16,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  criteriaLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  criteriaText: {
    fontSize: 14,
    color: "#D1D5DB",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  feeInfo: {
    margin: 20,
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  feeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 16,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  feeRowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 12,
    marginTop: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  feeValue: {
    fontSize: 14,
    color: "#F9FAFB",
  },
  feeLabelBold: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  feeValueBold: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  feeNote: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 12,
    fontStyle: "italic",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 16,
  },
  noParticipants: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  participantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  participantAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F9FAFB",
  },
  participantDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  participantContribution: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10B981",
  },
  shareCodeBox: {
    margin: 20,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  shareCodeLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  shareCode: {
    fontSize: 28,
    fontWeight: "800",
    color: "#6366F1",
    letterSpacing: 4,
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  secondaryButtonText: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
  },
  historyButton: {
    backgroundColor: "#1E3A5F",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  historyButtonText: {
    color: "#93C5FD",
    fontSize: 16,
    fontWeight: "700",
  },
  successButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#059669",
  },
  successButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  participatingBadge: {
    backgroundColor: "#065F46",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  participatingText: {
    color: "#6EE7B7",
    fontSize: 14,
    fontWeight: "600",
  },
  seekerBadge: {
    backgroundColor: "#1E3A8A",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  seekerText: {
    color: "#93C5FD",
    fontSize: 14,
    fontWeight: "600",
  },
  pendingInfo: {
    margin: 20,
    backgroundColor: "#422006",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FCD34D",
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 14,
    color: "#FDE68A",
    lineHeight: 20,
  },
  pendingEmail: {
    fontSize: 13,
    color: "#FCD34D",
    marginTop: 12,
    fontStyle: "italic",
  },
  groupGoalBadge: {
    margin: 20,
    marginBottom: 0,
    backgroundColor: "#1E3A5F",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  groupGoalBadgeText: {
    color: "#93C5FD",
    fontSize: 14,
    fontWeight: "700",
  },
  // Recurring series info styles
  recurringSeriesInfo: {
    margin: 20,
    marginBottom: 0,
    backgroundColor: "#1E3A5F",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  recurringSeriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recurringSeriesTitle: {
    color: "#93C5FD",
    fontSize: 14,
    fontWeight: "700",
  },
  recurringSeriesSubtitle: {
    color: "#FCD34D",
    fontSize: 12,
    fontWeight: "600",
  },
  recurringSeriesPattern: {
    color: "#BFDBFE",
    fontSize: 13,
    marginBottom: 12,
  },
  recurringSeriesProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  recurringSeriesDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recurringSeriesDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  recurringSeriesMore: {
    color: "#93C5FD",
    fontSize: 11,
    marginLeft: 4,
  },
  // Share modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1F2937",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#374151",
  },
  modalTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  modalOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  modalOptionDescription: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  modalCancelButton: {
    marginTop: 8,
    padding: 16,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600",
  },
  // Group goal section styles
  groupGoalSection: {
    margin: 20,
    marginTop: 0,
    backgroundColor: "#1E3A5F",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  groupGoalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  groupGoalName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    flex: 1,
    marginRight: 12,
  },
  groupGoalModeBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  groupGoalModeText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  groupGoalStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  groupGoalStat: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  groupGoalStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  groupGoalStatLabel: {
    fontSize: 12,
    color: "#93C5FD",
  },
  participantGoalsSection: {
    marginTop: 8,
  },
  participantGoalsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#93C5FD",
    marginBottom: 12,
  },
  participantGoalCard: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  participantGoalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  participantGoalTitle: {
    fontSize: 14,
    color: "#F9FAFB",
    flex: 1,
    marginRight: 8,
  },
  participantGoalStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  participantGoalStatusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  participantGoalYou: {
    fontSize: 11,
    color: "#FCD34D",
    marginTop: 4,
    fontWeight: "600",
  },
  // Reminder settings styles
  reminderSettingsToggle: {
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  reminderSettingsHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  reminderSettingsIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  reminderSettingsInfo: {
    flex: 1,
  },
  reminderSettingsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 2,
  },
  reminderSettingsSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  reminderSettingsArrow: {
    fontSize: 12,
    color: "#6B7280",
  },
  reminderSettingsContent: {
    marginHorizontal: 20,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 12,
  },
  reminderSettingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
  },
  reminderSettingInfo: {
    flex: 1,
    marginRight: 16,
  },
  reminderSettingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 2,
  },
  reminderSettingDescription: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  reminderSettingDisabled: {
    opacity: 0.5,
  },
  reminderSettingValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  reminderSettingValueText: {
    fontSize: 13,
    color: "#6366F1",
    marginRight: 8,
  },
  reminderSettingArrow: {
    fontSize: 18,
    color: "#6B7280",
  },
  // Picker styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    width: "100%",
    maxWidth: 320,
    maxHeight: 400,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 16,
    textAlign: "center",
  },
  pickerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: "#4F46E5",
  },
  pickerOptionText: {
    fontSize: 16,
    color: "#F9FAFB",
  },
  pickerOptionTextSelected: {
    fontWeight: "600",
  },
  pickerCheck: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  timeScrollView: {
    maxHeight: 250,
  },
  // Edit section styles
  editSection: {
    margin: 20,
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  editSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 12,
  },
  editTimeRemaining: {
    backgroundColor: "#065F46",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  editTimeRemainingText: {
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  editButtons: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  editDisabledReason: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  // Edit modal styles
  editModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  editModalContent: {
    backgroundColor: "#1F2937",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "#374151",
  },
  editModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  editModalClose: {
    fontSize: 24,
    color: "#6B7280",
    padding: 4,
  },
  editModalScroll: {
    padding: 20,
    maxHeight: 400,
  },
  editFormGroup: {
    marginBottom: 20,
  },
  editFormLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D1D5DB",
    marginBottom: 8,
  },
  editFormInput: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    color: "#F9FAFB",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  editFormTextArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  editFormDateButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#374151",
  },
  editFormDateText: {
    color: "#F9FAFB",
    fontSize: 16,
  },
  editFormDateNote: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  editModalActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  editModalCancelButton: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  editModalCancelText: {
    color: "#D1D5DB",
    fontSize: 16,
    fontWeight: "600",
  },
  editModalSaveButton: {
    flex: 1,
    backgroundColor: "#6366F1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  editModalSaveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  editModalButtonDisabled: {
    opacity: 0.5,
  },
  // Adjust amount modal styles
  adjustAmountContainer: {
    padding: 20,
    alignItems: "center",
  },
  adjustAmountLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 16,
  },
  adjustAmountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 12,
  },
  adjustAmountCurrency: {
    fontSize: 24,
    color: "#10B981",
    fontWeight: "700",
    marginRight: 8,
  },
  adjustAmountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    color: "#F9FAFB",
    paddingVertical: 16,
  },
  adjustAmountNote: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
});

export default GoalDetailScreen;
