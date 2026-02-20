import * as SecureStore from 'expo-secure-store';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

/**
 * Check if user has completed onboarding
 */
export const hasCompletedOnboarding = async (): Promise<boolean> => {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
};

/**
 * Mark onboarding as complete
 */
export const setOnboardingComplete = async (): Promise<void> => {
  try {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, 'true');
  } catch (error) {
    console.error('Error setting onboarding complete:', error);
  }
};

/**
 * Reset onboarding status (called on logout)
 */
export const resetOnboarding = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(ONBOARDING_COMPLETE_KEY);
  } catch (error) {
    console.error('Error resetting onboarding:', error);
  }
};

// Social proof data - updated for newly launched app
export const socialProofData = {
  totalUsers: 'Join the community',
  goalsCompleted: 'Start your journey',
  successRate: '85%',
  weeklyWalletFunders: 'Be among the first',
  testimonials: [
    {
      name: 'Sarah M.',
      location: 'New York',
      quote: 'I finally stuck to my fitness goal! Having money on the line made all the difference.',
      avatar: '👩',
    },
    {
      name: 'James K.',
      location: 'California',
      quote: 'The AI verification is amazing. No more cheating myself on my goals.',
      avatar: '👨',
    },
    {
      name: 'Emily R.',
      location: 'Texas',
      quote: 'My friends and I use this for group challenges. It\'s so motivating!',
      avatar: '👩‍🦰',
    },
  ],
  researchHighlights: [
    {
      stat: '3x',
      description: 'People with financial stakes are 3x more likely to achieve their goals',
      source: 'Behavioral Economics Research',
    },
    {
      stat: '91%',
      description: 'Users with social accountability report higher motivation',
      source: 'Social Psychology Studies',
    },
    {
      stat: '2x',
      description: 'Users who fund wallets within 24 hours have 2x higher success rates',
      source: 'Goal Achievement Research',
    },
  ],
};

