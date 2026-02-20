import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { hasCompletedOnboarding, setOnboardingComplete as saveOnboardingComplete, resetOnboarding } from '../utils/onboarding';

interface OnboardingContextType {
  onboardingComplete: boolean | null;
  completeOnboarding: () => Promise<void>;
  resetOnboardingState: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await hasCompletedOnboarding();
      setOnboardingComplete(completed);
    };
    checkOnboarding();
  }, []);

  const completeOnboarding = async () => {
    await saveOnboardingComplete();
    setOnboardingComplete(true);
  };

  const resetOnboardingState = async () => {
    await resetOnboarding();
    setOnboardingComplete(false);
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingComplete,
        completeOnboarding,
        resetOnboardingState,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};


