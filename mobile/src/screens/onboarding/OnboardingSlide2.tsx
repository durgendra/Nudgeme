import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../store/ThemeContext';
import { Theme } from '../../theme';
import { socialProofData } from '../../utils/onboarding';

const { width } = Dimensions.get('window');

interface StepProps {
  number: number;
  icon: string;
  title: string;
  description: string;
  isLast?: boolean;
  theme: Theme;
}

const Step: React.FC<StepProps> = ({ number, icon, title, description, isLast, theme }) => {
  const styles = createStepStyles(theme);
  
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepLeft}>
        <View style={styles.stepNumberContainer}>
          <Text style={styles.stepNumber}>{number}</Text>
        </View>
        {!isLast && <View style={styles.stepLine} />}
      </View>
      <View style={styles.stepContent}>
        <View style={styles.stepIconContainer}>
          <Text style={styles.stepIcon}>{icon}</Text>
        </View>
        <View style={styles.stepTextContainer}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepDescription}>{description}</Text>
        </View>
      </View>
    </View>
  );
};

const OnboardingSlide2: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const steps = [
    {
      icon: '🎯',
      title: 'Create Your Goal',
      description: 'Set a goal and add seed money from your wallet as commitment',
    },
    {
      icon: '👥',
      title: 'Invite Supporters',
      description: 'Share with friends who can join and add to the pot',
    },
    {
      icon: '🤖',
      title: 'Verify with AI',
      description: 'Submit proof and let our AI verify your completion',
    },
    {
      icon: '💰',
      title: 'Get Rewarded',
      description: 'Succeed and receive 95% of the total pot!',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>How It Works</Text>
        <Text style={styles.headerSubtitle}>
          Simple steps to goal success
        </Text>
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <Step
            key={index}
            number={index + 1}
            icon={step.icon}
            title={step.title}
            description={step.description}
            isLast={index === steps.length - 1}
            theme={theme}
          />
        ))}
      </View>

      {/* Social Proof */}
      <View style={styles.socialProofContainer}>
        <View style={styles.socialProofCard}>
          <Text style={styles.socialProofStat}>{socialProofData.goalsCompleted}</Text>
          <Text style={styles.socialProofLabel}>Your Journey Begins</Text>
        </View>
      </View>

      {/* Outcome Preview */}
      <View style={styles.outcomeContainer}>
        <View style={styles.outcomeCard}>
          <View style={styles.outcomeRow}>
            <Text style={styles.outcomeIcon}>✅</Text>
            <View style={styles.outcomeTextContainer}>
              <Text style={styles.outcomeTitle}>If You Succeed</Text>
              <Text style={styles.outcomeDescription}>
                You receive 95% of the total pot (5% platform fee)
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.outcomeCard, styles.outcomeCardSecondary]}>
          <View style={styles.outcomeRow}>
            <Text style={styles.outcomeIcon}>🔄</Text>
            <View style={styles.outcomeTextContainer}>
              <Text style={styles.outcomeTitle}>If You Don't</Text>
              <Text style={styles.outcomeDescription}>
                Supporters get refunded + share of your seed money
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const createStepStyles = (theme: Theme) => StyleSheet.create({
  stepContainer: {
    flexDirection: 'row',
    minHeight: 70,
  },
  stepLeft: {
    alignItems: 'center',
    width: 40,
  },
  stepNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    flexDirection: 'row',
    paddingBottom: 16,
    paddingLeft: 12,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepIcon: {
    fontSize: 22,
  },
  stepTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    width,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
  },
  stepsContainer: {
    marginBottom: 24,
  },
  socialProofContainer: {
    marginBottom: 20,
  },
  socialProofCard: {
    backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(5, 150, 105, 0.2)',
  },
  socialProofStat: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: theme.colors.success,
    marginBottom: 4,
  },
  socialProofLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
  },
  outcomeContainer: {
    gap: 10,
  },
  outcomeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  outcomeCardSecondary: {
    backgroundColor: theme.isDark ? 'rgba(31, 41, 55, 0.5)' : 'rgba(241, 245, 249, 0.8)',
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outcomeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  outcomeTextContainer: {
    flex: 1,
  },
  outcomeTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  outcomeDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
});

export default OnboardingSlide2;
