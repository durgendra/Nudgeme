import * as SecureStore from 'expo-secure-store';
import { 
  AuthResponse, 
  User, 
  Goal, 
  GroupGoal,
  GoalDetailResponse, 
  WalletResponse, 
  TransactionsResponse,
  Verification,
  Participant,
  RecurringSeriesResponse,
  ReminderPreferences,
  ReminderPreferencesResponse,
  GoalReminderSettings,
  ReminderSettingsResponse,
  ReminderFrequency
} from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Token storage
const TOKEN_KEY = 'auth_token';

export const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const removeToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

// API request helper
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
};

// Auth API
export const authApi = {
  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    await setToken(response.token);
    return response;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setToken(response.token);
    return response;
  },

  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    await setToken(response.token);
    return response;
  },

  getMe: async (): Promise<{ user: User }> => {
    return apiRequest('/auth/me');
  },

  updatePushToken: async (pushToken: string): Promise<void> => {
    await apiRequest('/auth/push-token', {
      method: 'PUT',
      body: JSON.stringify({ pushToken }),
    });
  },

  logout: async (): Promise<void> => {
    await removeToken();
  },

  // Update user profile
  updateProfile: async (data: { name?: string; profileImage?: string }): Promise<{
    message: string;
    user: User;
  }> => {
    return apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Get user reminder preferences
  getReminderPreferences: async (): Promise<ReminderPreferencesResponse> => {
    return apiRequest('/auth/reminder-preferences');
  },

  // Update user reminder preferences
  updateReminderPreferences: async (preferences: Partial<ReminderPreferences>): Promise<{
    message: string;
    reminderPreferences: ReminderPreferences;
  }> => {
    return apiRequest('/auth/reminder-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
};

// Clarification type for AI goal evaluation
export interface Clarification {
  question: string;
  answer: string;
  answeredAt?: Date;
}

// Evaluated criteria from AI
export interface EvaluatedCriteria {
  keyKPI: string;
  currentStatus: string;
  targetKPI: string;
  progressMeasurement: string;
  successCriteria: string;
  failureCriteria: string;
  proofMethod: string;
}

// AI evaluation question
export interface EvaluationQuestion {
  id: string;
  text: string;
  options: Array<{ id: string; label: string }>;
}

// Goals API
export const goalsApi = {
  // Evaluate goal with AI before creation
  evaluate: async (data: {
    title: string;
    description?: string;
    verificationCriteria?: string;
    previousClarifications?: Clarification[];
    latestAnswer?: { question: string; answer: string };
  }): Promise<{
    status: 'needs_clarification' | 'ready';
    question?: EvaluationQuestion;
    clarifications: Clarification[];
    confirmation?: {
      message: string;
      goalDetails: {
        title: string;
        description: string;
        verificationCriteria: string;
        clarifications: Clarification[];
      };
      evaluatedCriteria: EvaluatedCriteria;
    };
    evaluatedCriteria?: EvaluatedCriteria;
  }> => {
    return apiRequest('/goals/evaluate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Assist goal creation with AI
  assistCreate: async (data: {
    conversationHistory?: Array<{ question: string; answer: string; answeredAt?: Date }>;
    latestAnswer?: {
      questionId: string;
      questionText: string;
      answer: string;
    };
    collectedData?: {
      goalType?: 'self' | 'gift' | 'group';
      title?: string;
      description?: string;
      startDate?: string;
      deadline?: string;
      seedAmount?: number;
      verificationCriteria?: string;
      seekerEmail?: string;
      groupName?: string;
      goalMode?: 'common' | 'individual';
      isRecurring?: boolean;
      recurrencePattern?: 'daily' | 'weekly' | 'monthly';
      recurrenceEndDate?: string;
    };
  }): Promise<{
    status: 'needs_info' | 'ready';
    question?: {
      id: string;
      text: string;
      options?: Array<{ id: string; label: string }>;
    };
    collectedData?: any;
    summary?: any;
    conversationHistory?: Array<{ question: string; answer: string; answeredAt?: Date }>;
  }> => {
    return apiRequest('/goals/assist-create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  create: async (data: {
    title: string;
    description?: string;
    startDate?: string;
    deadline: string;
    seedAmount: number;
    verificationType?: 'image' | 'data';
    verificationCriteria?: string;
    seekerEmail?: string;
    goalType?: 'self' | 'gift' | 'group';
    // Group goal fields
    groupName?: string;
    goalMode?: 'common' | 'individual';
    // Recurring goal fields
    isRecurring?: boolean;
    recurrencePattern?: 'daily' | 'weekly' | 'monthly';
    recurrenceEndDate?: string;
    // AI evaluation fields
    clarifications?: Clarification[];
    evaluatedCriteria?: EvaluatedCriteria;
  }): Promise<{ 
    message: string; 
    goal: Goal; 
    groupGoal?: GroupGoal;
    goals?: Goal[]; // All goals in recurring series
    totalGoals?: number;
    recurringGroupId?: string;
    shareLink: string; 
    needsAcceptance?: boolean;
    goalMode?: 'common' | 'individual';
  }> => {
    return apiRequest('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAll: async (params?: { status?: string; type?: string }): Promise<{
    createdGoals?: Goal[];
    participatingGoals?: Goal[];
    seekerGoals?: Goal[];
    goals?: Goal[];
  }> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return apiRequest(`/goals${query}`);
  },

  getById: async (idOrCode: string): Promise<GoalDetailResponse> => {
    return apiRequest(`/goals/${idOrCode}`);
  },

  join: async (goalIdOrCode: string, contributionAmount: number): Promise<{ message: string; participation?: any }> => {
    return apiRequest(`/goals/${goalIdOrCode}/join`, {
      method: 'POST',
      body: JSON.stringify({ contributionAmount }),
    });
  },

  accept: async (goalIdOrCode: string, acceptAll: boolean = false): Promise<{ 
    message: string; 
    goal: Goal;
    acceptedGoals?: Goal[];
    totalAccepted?: number;
  }> => {
    const query = acceptAll ? '?acceptAll=true' : '';
    return apiRequest(`/goals/${goalIdOrCode}/accept${query}`, {
      method: 'POST',
    });
  },

  getParticipants: async (goalId: string): Promise<{
    participants: Participant[];
    count: number;
    totalContributions: number;
    totalContributionsDollars: string;
  }> => {
    return apiRequest(`/goals/${goalId}/participants`);
  },

  // Get all goals in a recurring series
  getRecurringSeries: async (groupId: string): Promise<RecurringSeriesResponse> => {
    return apiRequest(`/goals/recurring/${groupId}`);
  },

  // Group goal methods
  getGroupGoal: async (idOrCode: string): Promise<{
    groupGoal: GroupGoal;
    participantGoals: Goal[];
    participants: Array<{
      user: User;
      contribution: number;
      goalId: string;
      goalTitle?: string;
      goalStatus?: string;
      joinedAt: string;
    }>;
    participantCount: number;
    isGroupCreator: boolean;
    isParticipating: boolean;
    userGoalId?: string;
    userContribution: number;
    platformFeePreview: {
      percentage: number;
      estimatedFee: number;
      estimatedPayout: number;
      payoutPerParticipant: number;
    };
  }> => {
    return apiRequest(`/goals/group/${idOrCode}`);
  },

  joinGroupGoal: async (idOrCode: string, data: {
    contributionAmount: number;
    title?: string; // Required for individual mode
    description?: string;
    verificationCriteria?: string;
  }): Promise<{
    message: string;
    goal?: Goal;
    participation?: any;
    groupGoal: GroupGoal;
  }> => {
    return apiRequest(`/goals/group/${idOrCode}/join`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getMyGroupGoals: async (): Promise<{
    createdGroups: GroupGoal[];
    participatingGroups: GroupGoal[];
  }> => {
    return apiRequest('/goals/groups/my');
  },

  // Get goal reminder settings
  getReminderSettings: async (goalIdOrCode: string): Promise<ReminderSettingsResponse> => {
    return apiRequest(`/goals/${goalIdOrCode}/reminder-settings`);
  },

  // Update goal reminder settings
  updateReminderSettings: async (
    goalIdOrCode: string,
    settings: {
      enabled?: boolean;
      frequency?: ReminderFrequency | null;
      reminderTime?: string | null;
    }
  ): Promise<{
    message: string;
    reminderSettings: GoalReminderSettings;
    isGoalLevel: boolean;
  }> => {
    return apiRequest(`/goals/${goalIdOrCode}/reminder-settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // Get edit permissions for a goal
  getEditPermissions: async (goalIdOrCode: string): Promise<{
    canEditGoal: boolean;
    editGoalReason?: string;
    editGoalDeadline?: string;
    canAdjustAmount: boolean;
    adjustType?: 'seed' | 'contribution';
    adjustAmountReason?: string;
    canEditGroupGoal: boolean;
    editGroupGoalReason?: string;
    editGroupGoalDeadline?: string;
    currentSeedAmount: number;
    currentContribution: number;
    minAmount: number;
  }> => {
    return apiRequest(`/goals/${goalIdOrCode}/edit-permissions`);
  },

  // Update goal fields (within 24-hour window)
  update: async (
    goalIdOrCode: string,
    data: {
      title?: string;
      description?: string;
      startDate?: string;
      deadline?: string;
      verificationType?: 'image' | 'data';
      verificationCriteria?: string;
    }
  ): Promise<{
    message: string;
    goal: Goal;
    editDeadline?: string;
  }> => {
    return apiRequest(`/goals/${goalIdOrCode}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Adjust seed money or contribution amount
  adjustSeedAmount: async (
    goalIdOrCode: string,
    newAmount: number
  ): Promise<{
    message: string;
    goal?: Goal;
    participation?: any;
    oldAmount: number;
    newAmount: number;
    difference: number;
    walletBalance: number;
  }> => {
    return apiRequest(`/goals/${goalIdOrCode}/seed-amount`, {
      method: 'PUT',
      body: JSON.stringify({ newAmount }),
    });
  },

  // Update group goal fields (within 24-hour window)
  updateGroupGoal: async (
    groupGoalIdOrCode: string,
    data: {
      groupName?: string;
      startDate?: string;
      deadline?: string;
    }
  ): Promise<{
    message: string;
    groupGoal: GroupGoal;
    editDeadline?: string;
  }> => {
    return apiRequest(`/goals/group/${groupGoalIdOrCode}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Payments API
export const paymentsApi = {
  getWalletBalance: async (): Promise<WalletResponse> => {
    return apiRequest('/payments/wallet-balance');
  },

  addFunds: async (amount: number): Promise<{
    // Development mode response
    devMode?: boolean;
    message?: string;
    newBalance?: number;
    newBalanceDollars?: string;
    // Production mode response
    clientSecret?: string;
    paymentIntentId?: string;
  }> => {
    return apiRequest('/payments/add-funds', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  withdraw: async (amount: number): Promise<{ message: string; transaction: any }> => {
    return apiRequest('/payments/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  getTransactions: async (params?: { 
    limit?: number; 
    offset?: number; 
    type?: string 
  }): Promise<TransactionsResponse> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return apiRequest(`/payments/transactions${query}`);
  },
};

// Verification status types
export type VerificationStatus = 'not_related' | 'progress' | 'completed';

// Chat message types
export interface ChatMessageContent {
  text?: string;
  imageUrl?: string;
  attachments?: Array<{
    type: 'image' | 'document' | 'link';
    url: string;
    name?: string;
  }>;
  verificationId?: string;
}

export interface ChatAIResult {
  status: VerificationStatus;
  reasoning: string;
  confidence?: number;
}

export interface ChatReaction {
  _id: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    name: string;
    profileImage?: string;
  };
}

export interface ChatMessage {
  _id: string;
  type: 'system' | 'verification' | 'ai_response' | 'participant_comment';
  senderId?: {
    _id: string;
    name: string;
    email?: string;
    profileImage?: string;
  };
  content: ChatMessageContent;
  aiResult?: ChatAIResult;
  reactions: ChatReaction[];
  createdAt: string;
}

export interface ChatData {
  _id: string;
  goalId: string;
  messages: ChatMessage[];
  initialSummary: {
    title: string;
    objective?: string;
    verificationMethod?: string;
    clarifications?: Array<{ question: string; answer: string }>;
    evaluatedCriteria?: {
      keyKPI?: string;
      currentStatus?: string;
      targetKPI?: string;
      progressMeasurement?: string;
      successCriteria?: string;
      failureCriteria?: string;
      proofMethod?: string;
    };
  };
  completionConfirmed: boolean;
  completionConfirmedAt?: string;
}

export interface VerificationSubmitResult {
  message: string;
  verification: {
    id: string;
    aiResult: {
      verified: boolean;
      verificationStatus: VerificationStatus;
      confidence: number;
      reasoning: string;
    };
    finalStatus: string;
    needsManualReview: boolean;
  };
  goalStatus: string;
  canConfirmCompletion: boolean;
}

// Verification API
export const verificationApi = {
  // Submit image verification
  submit: async (goalId: string, proofImage: string): Promise<VerificationSubmitResult> => {
    const formData = new FormData();
    formData.append('proofImage', {
      uri: proofImage,
      type: 'image/jpeg',
      name: 'proof.jpg',
    } as any);

    const token = await getToken();
    
    const response = await fetch(`${API_BASE_URL}/verification/${goalId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit verification');
    }
    return data;
  },

  // Submit text verification with optional attachments
  submitTextVerification: async (
    goalId: string,
    text: string,
    attachments: Array<{ type: 'image' | 'document' | 'link'; url: string; name?: string }>
  ): Promise<VerificationSubmitResult> => {
    const formData = new FormData();
    formData.append('proofText', text);
    if (attachments.length > 0) {
      formData.append('attachments', JSON.stringify(attachments));
    }

    const token = await getToken();
    
    const response = await fetch(`${API_BASE_URL}/verification/${goalId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit verification');
    }
    return data;
  },

  // Get chat history for a goal
  getChatHistory: async (goalId: string): Promise<{
    chat: ChatData;
    goal: {
      _id: string;
      title: string;
      status: string;
      deadline: string;
      goalType?: string;
    };
    userRole: 'seeker' | 'participant';
    canSubmitVerification: boolean;
  }> => {
    return apiRequest(`/verification/${goalId}/chat`);
  },

  // Add reaction to a message
  addReaction: async (goalId: string, messageId: string, emoji: string): Promise<{
    message: string;
    reactions: ChatReaction[];
  }> => {
    return apiRequest(`/verification/${goalId}/chat/react`, {
      method: 'POST',
      body: JSON.stringify({ messageId, emoji }),
    });
  },

  // Remove reaction from a message
  removeReaction: async (goalId: string, messageId: string, emoji: string): Promise<{
    message: string;
    reactions: ChatReaction[];
  }> => {
    return apiRequest(`/verification/${goalId}/chat/react`, {
      method: 'POST',
      body: JSON.stringify({ messageId, emoji }), // Toggle behavior - same endpoint removes if exists
    });
  },

  // Add participant comment (AI won't respond)
  addComment: async (goalId: string, text: string): Promise<{
    message: string;
    chatMessage: ChatMessage;
  }> => {
    return apiRequest(`/verification/${goalId}/chat/comment`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // Confirm goal completion
  confirmComplete: async (goalId: string): Promise<{
    message: string;
    goalStatus: string;
    completionConfirmed: boolean;
  }> => {
    return apiRequest(`/verification/${goalId}/confirm-complete`, {
      method: 'POST',
    });
  },

  // Get verification status (backward compatible)
  getStatus: async (goalId: string): Promise<{ 
    verification: Verification;
    verifications?: Verification[];
    count?: number;
  }> => {
    return apiRequest(`/verification/${goalId}`);
  },

  // Get all verifications for a group goal
  getGroupVerifications: async (groupGoalId: string): Promise<{
    groupGoal: {
      _id: string;
      groupName: string;
      goalMode: 'common' | 'individual';
      deadline: string;
      status: string;
    };
    verifications: Array<Verification & { goalTitle?: string; goalId?: string }>;
    summary: {
      total: number;
      verified: number;
      rejected: number;
      pending: number;
      byStatus?: {
        completed: number;
        progress: number;
        not_related: number;
      };
    };
  }> => {
    return apiRequest(`/verification/group/${groupGoalId}`);
  },
};

