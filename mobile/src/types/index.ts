// Reminder frequency type
export type ReminderFrequency = "daily" | "weekly" | "monthly";

// User reminder preferences
export interface ReminderPreferences {
  enabled: boolean;
  defaultFrequency: ReminderFrequency | null;
  defaultReminderTime: string; // HH:mm format
  timezone: string | null;
}

// Goal reminder settings (for goal owners/seekers)
export interface GoalReminderSettings {
  enabled: boolean;
  frequency: ReminderFrequency | null;
  reminderTime: string | null; // HH:mm format
  lastReminderSent: string | null;
}

// Participant reminder settings
export interface ParticipantReminderSettings {
  enabled: boolean;
  reminderTime: string | null; // HH:mm format
  lastReminderSent: string | null;
}

// User types
export interface User {
  _id: string;
  email: string;
  name: string;
  walletBalance: number;
  profileImage?: string;
  isVerified: boolean;
  reminderPreferences?: ReminderPreferences;
  createdAt: string;
  updatedAt: string;
}

// Verification progress types - secondary status indicator
export type VerificationProgress =
  | "no_update"
  | "good_progress"
  | "fully_completed";

// GroupGoal types - for group goals with common or individual goals
export interface GroupGoal {
  _id: string;
  groupName: string;
  creatorId: string | User;
  goalMode: "common" | "individual";
  deadline: string;
  startDate?: string;
  isRecurring: boolean;
  recurrencePattern?: "daily" | "weekly" | "monthly";
  recurrenceEndDate?: string;
  currentCycle: number;
  sharedPot: number;
  minSeedAmount: number;
  status: "active" | "completed" | "failed";
  shareCode: string;
  commonGoalId?: string;
  participantGoalIds: string[];
  platformFeeAmount: number;
  completedAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Goal types
export interface Goal {
  _id: string;
  creatorId: string | User;
  // Seeker fields - for goals created on behalf of someone else
  seekerEmail?: string;
  seekerId?: string | User;
  acceptedAt?: string;
  title: string;
  description: string;
  startDate?: string;
  deadline: string;
  seedAmount: number;
  totalPot: number;
  platformFeeAmount: number;
  status:
    | "not_started"
    | "pending_acceptance"
    | "active"
    | "completed"
    | "failed";
  verificationType: "image" | "data";
  verificationCriteria?: string;
  shareCode: string;
  completedAt?: string;
  failedAt?: string;
  goalType?: "self" | "gift" | "group";
  // Group goal fields
  groupGoalId?: string | GroupGoal;
  groupParticipantId?: string | User;
  // Recurring goal fields
  isRecurring?: boolean;
  recurrencePattern?: "daily" | "weekly" | "monthly";
  recurrenceEndDate?: string;
  recurringGroupId?: string;
  recurringIndex?: number;
  // Verification progress (secondary status)
  verificationProgress?: VerificationProgress;
  createdAt: string;
  updatedAt: string;
}

// Recurring series info
export interface RecurringSeriesGoalSummary {
  _id: string;
  status: Goal["status"];
  recurringIndex: number;
  deadline: string;
}

export interface RecurringSeriesInfo {
  groupId: string;
  totalGoals: number;
  currentIndex: number;
  pattern: "daily" | "weekly" | "monthly";
  endDate: string;
  goals: RecurringSeriesGoalSummary[];
}

// Participation types
export interface Participation {
  _id: string;
  goalId: string;
  userId: string | User;
  contributionAmount: number;
  status: "active" | "refunded" | "distributed";
  createdAt: string;
}

export interface Participant {
  user: User;
  contribution: number;
  joinedAt: string;
}

// Transaction types
export interface Transaction {
  _id: string;
  userId: string;
  type:
    | "deposit"
    | "withdrawal"
    | "goal_contribution"
    | "goal_payout"
    | "refund"
    | "platform_fee";
  amount: number;
  amountDollars: string;
  direction: "credit" | "debit";
  goalId?: string | Goal;
  stripePaymentIntentId?: string;
  status: "pending" | "completed" | "failed";
  description?: string;
  createdAt: string;
}

// Verification status types
export type VerificationStatus = "not_related" | "progress" | "completed";

// Verification types
export interface Verification {
  _id: string;
  goalId: string;
  submittedBy: string;
  proofImageUrl?: string;
  proofText?: string;
  attachments?: Array<{
    type: "image" | "document" | "link";
    url: string;
    name?: string;
    mimeType?: string;
  }>;
  aiVerificationResult?: {
    verified: boolean;
    verificationStatus?: VerificationStatus;
    confidence: number;
    reasoning: string;
  };
  manualReviewStatus: "pending" | "approved" | "rejected" | "not_required";
  finalStatus: "pending" | "verified" | "rejected";
  createdAt: string;
}

// API Response types
export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

// Group goal info for API responses
export interface GroupGoalInfo {
  groupGoal: GroupGoal;
  participantGoals: Goal[];
  participantCount: number;
  isGroupCreator: boolean;
  userGoalId?: string; // User's individual goal ID (for individual mode)
}

export interface GoalDetailResponse {
  goal: Goal;
  participants: Participant[];
  participantCount: number;
  isCreator: boolean;
  isSeeker: boolean;
  isParticipating: boolean;
  userContribution: number;
  needsAcceptance: boolean;
  canAccept: boolean;
  platformFeePreview: {
    percentage: number;
    estimatedFee: number;
    estimatedSeekerPayout: number;
  };
  recurringSeriesInfo?: RecurringSeriesInfo;
  groupGoalInfo?: GroupGoalInfo;
}

// Recurring series response
export interface RecurringSeriesResponse {
  recurringGroupId: string;
  totalGoals: number;
  recurrencePattern: "daily" | "weekly" | "monthly";
  recurrenceEndDate: string;
  statusCounts: {
    not_started: number;
    pending_acceptance: number;
    active: number;
    completed: number;
    failed: number;
  };
  goals: Goal[];
}

export interface WalletResponse {
  balanceCents: number;
  balanceDollars: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

// Reminder settings response from API
export interface ReminderSettingsResponse {
  reminderSettings: GoalReminderSettings | ParticipantReminderSettings;
  isGoalLevel: boolean;
}

export interface ReminderPreferencesResponse {
  reminderPreferences: ReminderPreferences;
}

// Goal data for AI clarification
export interface GoalFormData {
  title: string;
  description?: string;
  seedAmount: number;
  startDate: string;
  deadline: string;
  verificationCriteria?: string;
  seekerEmail?: string;
  goalType: "self" | "gift" | "group";
  groupName?: string;
  goalMode?: "common" | "individual";
  isRecurring?: boolean;
  recurrencePattern?: "daily" | "weekly" | "monthly";
  recurrenceEndDate?: string;
}

// Navigation types
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: { screen?: 'Login' | 'Register' } | undefined;
  Main: undefined;
  GoalDetail: { goalId?: string; shareCode?: string; groupGoalId?: string };
  CreateGoal: { goalType?: "self" | "gift" | "group" };
  AIGoalClarification: { goalData: GoalFormData };
  AIGoalCreation: undefined;
  JoinGoal: { goalId?: string; shareCode?: string; groupGoalId?: string };
  AcceptGoal: { goalId?: string; shareCode?: string };
  AddFunds: undefined;
  Withdraw: undefined;
  VerificationChat: { goalId: string };
  GroupGoalDetail: { groupGoalId: string };
  EditProfile: undefined;
  PaymentMethods: undefined;
  PrivacySecurity: undefined;
  TermsOfService: undefined;
  HelpSupport: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  MyGoals: undefined;
  Wallet: undefined;
  Profile: undefined;
};
