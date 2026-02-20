/**
 * Utility formatting functions
 *
 * Note: Status colors are designed to work in both dark and light themes.
 * They use vibrant colors that have good contrast on any background.
 */

/**
 * Format cents to dollars string
 */
export const formatCentsToDollars = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

/**
 * Format a date string to a readable format
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format a date string to include time
 */
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Calculate days until deadline
 */
export const getDaysUntilDeadline = (deadline: string): number => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Get deadline status text
 */
export const getDeadlineStatus = (deadline: string): string => {
  const days = getDaysUntilDeadline(deadline);

  if (days < 0) {
    return "Expired";
  } else if (days === 0) {
    return "Due today";
  } else if (days === 1) {
    return "1 day left";
  } else if (days <= 7) {
    return `${days} days left`;
  } else {
    return formatDate(deadline);
  }
};

/**
 * Status color palette - works in both dark and light themes
 * These are semantic colors that maintain meaning across themes
 */
const STATUS_COLORS = {
  // Not started - neutral gray (visible on both themes)
  not_started: "#64748B",
  // Pending acceptance - attention-grabbing amber
  pending_acceptance: "#F59E0B",
  // Active - vibrant green (success/active)
  active: "#10B981",
  // Completed - trustworthy blue
  completed: "#3B82F6",
  // Failed - clear red (danger)
  failed: "#EF4444",
  // Default - neutral
  default: "#94A3B8",
};

/**
 * Get status color
 * Returns a color that works well on both dark and light backgrounds
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case "not_started":
      return STATUS_COLORS.not_started;
    case "pending_acceptance":
      return STATUS_COLORS.pending_acceptance;
    case "active":
      return STATUS_COLORS.active;
    case "completed":
      return STATUS_COLORS.completed;
    case "failed":
      return STATUS_COLORS.failed;
    default:
      return STATUS_COLORS.default;
  }
};

/**
 * Verification progress color palette
 */
const PROGRESS_COLORS = {
  // No update - muted gray
  no_update: "#64748B",
  // Good progress - encouraging amber/orange
  good_progress: "#F59E0B",
  // Fully completed - celebration green
  fully_completed: "#10B981",
};

/**
 * Get verification progress color
 * Returns a color that works well on both dark and light backgrounds
 */
export const getVerificationProgressColor = (progress: string): string => {
  switch (progress) {
    case "no_update":
      return PROGRESS_COLORS.no_update;
    case "good_progress":
      return PROGRESS_COLORS.good_progress;
    case "fully_completed":
      return PROGRESS_COLORS.fully_completed;
    default:
      return PROGRESS_COLORS.no_update;
  }
};

/**
 * Get verification progress label
 */
export const getVerificationProgressLabel = (progress: string): string => {
  switch (progress) {
    case "no_update":
      return "No Update Yet";
    case "good_progress":
      return "Good Progress";
    case "fully_completed":
      return "100% Completed";
    default:
      return "";
  }
};

/**
 * Get verification progress emoji
 */
export const getVerificationProgressEmoji = (progress: string): string => {
  switch (progress) {
    case "no_update":
      return "📝";
    case "good_progress":
      return "📈";
    case "fully_completed":
      return "✓";
    default:
      return "";
  }
};

/**
 * Check if verification progress badge should be shown
 * Only show for active, completed, and failed goals
 */
export const shouldShowVerificationProgress = (status: string): boolean => {
  return status === "active" || status === "completed" || status === "failed";
};

/**
 * Transaction type colors and labels
 */
const TRANSACTION_TYPES = {
  deposit: { label: "Deposit", color: "#10B981" },
  withdrawal: { label: "Withdrawal", color: "#EF4444" },
  goal_contribution: { label: "Goal Contribution", color: "#F59E0B" },
  goal_payout: { label: "Goal Payout", color: "#10B981" },
  refund: { label: "Refund", color: "#3B82F6" },
  platform_fee: { label: "Platform Fee", color: "#64748B" },
};

/**
 * Get transaction type label
 */
export const getTransactionTypeLabel = (type: string): string => {
  const transaction = TRANSACTION_TYPES[type as keyof typeof TRANSACTION_TYPES];
  return transaction?.label || type;
};

/**
 * Get transaction type color
 */
export const getTransactionTypeColor = (type: string): string => {
  const transaction = TRANSACTION_TYPES[type as keyof typeof TRANSACTION_TYPES];
  return transaction?.color || "#94A3B8";
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Format share link
 */
export const getShareMessage = (goal: {
  title: string;
  shareCode: string;
  totalPot: number;
}): string => {
  return `Join my goal "${
    goal.title
  }" on NudgeMe! Total pot: ${formatCentsToDollars(goal.totalPot)}. Use code: ${
    goal.shareCode
  } or tap the link: nudgeme://goal/${goal.shareCode}`;
};

/**
 * Format success share message for completed goals
 * This is a celebration message, not an invitation to join
 */
export const getSuccessShareMessage = (goal: {
  title: string;
  totalPot: number;
  completedAt?: string;
  shareCode: string;
}): string => {
  const completionDate = goal.completedAt
    ? formatDate(goal.completedAt)
    : "recently";
  return `🎉 I completed my goal "${
    goal.title
  }" on NudgeMe! Total pot: ${formatCentsToDollars(
    goal.totalPot
  )}. Completed on ${completionDate}. View my achievement: nudgeme://goal/${
    goal.shareCode
  }`;
};
