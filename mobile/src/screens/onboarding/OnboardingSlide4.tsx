import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useTheme } from '../../store/ThemeContext';
import { Theme } from '../../theme';
import { socialProofData } from '../../utils/onboarding';

const { width } = Dimensions.get('window');

interface OnboardingSlide4Props {
  onSignUp?: () => void;
  onSignIn?: () => void;
}

const OnboardingSlide4: React.FC<OnboardingSlide4Props> = ({ onSignUp, onSignIn }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleSignUp = () => {
    console.log('Sign up button pressed');
    if (onSignUp) {
      onSignUp();
    } else {
      console.warn('onSignUp prop not provided');
    }
  };

  const handleSignIn = () => {
    console.log('Sign in button pressed');
    if (onSignIn) {
      onSignIn();
    } else {
      console.warn('onSignIn prop not provided');
    }
  };

  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.contentContainer}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🚀</Text>
          <Text style={styles.heroTitle}>Ready to Achieve{'\n'}Your Goals?</Text>
          <Text style={styles.heroSubtitle}>
            Start your journey to success with financial accountability
          </Text>
        </View>

        {/* Social Proof */}
        <View style={styles.socialProofSection}>
          <View style={styles.socialProofRow}>
            <View style={styles.socialProofItem}>
              <Text style={styles.socialProofIcon}>💳</Text>
              <Text style={styles.socialProofValue}>{socialProofData.weeklyWalletFunders}</Text>
              <Text style={styles.socialProofLabel}>Wallet Funding{'\n'}Secure & Easy</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.socialProofItem}>
              <Text style={styles.socialProofIcon}>🏆</Text>
              <Text style={styles.socialProofValue}>{socialProofData.successRate}</Text>
              <Text style={styles.socialProofLabel}>Proven Success{'\n'}Rate</Text>
            </View>
          </View>
        </View>

        {/* Research Highlight */}
        <View style={styles.researchHighlight}>
          <Text style={styles.researchIcon}>📈</Text>
          <Text style={styles.researchText}>
            <Text style={styles.researchBold}>Research shows</Text>{' '}
            that users who fund wallets early have significantly higher success rates
          </Text>
        </View>

        {/* Security Assurance */}
        <View style={styles.securitySection}>
          <View style={styles.securityBadge}>
            <Text style={styles.securityIcon}>🔐</Text>
            <Text style={styles.securityText}>Bank-level security with Stripe</Text>
          </View>
          <Text style={styles.securityNote}>
            Your money is safe. Withdraw anytime.
          </Text>
        </View>
      </View>

      {/* CTA Buttons */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleSignUp}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Create Free Account</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleSignIn}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>I Already Have an Account</Text>
        </TouchableOpacity>

        {/* Legal Note */}
        <Text style={styles.legalNote}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    width,
    backgroundColor: theme.colors.background,
    paddingTop: 50,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: theme.isDark ? 'Inter-Bold' : 'Inter-SemiBold',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  socialProofSection: {
    marginBottom: 24,
  },
  socialProofRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.cardSmall,
    padding: 20,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  socialProofItem: {
    flex: 1,
    alignItems: 'center',
  },
  socialProofIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  socialProofValue: {
    fontSize: 24,
    fontFamily: theme.isDark ? 'JetBrainsMono-Bold' : 'Inter-Bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  socialProofLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  researchHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.borderRadius.button,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.success,
    marginBottom: 20,
  },
  researchIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  researchText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.isDark ? '#D1D5DB' : theme.colors.textPrimary,
    lineHeight: 20,
  },
  researchBold: {
    fontFamily: 'Inter-Bold',
    color: theme.colors.success,
  },
  securitySection: {
    alignItems: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  securityIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  securityText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: theme.colors.textPrimary,
  },
  securityNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textMuted,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.button,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    ...theme.shadows.button,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.button,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: theme.isDark ? '#D1D5DB' : theme.colors.textSecondary,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  legalNote: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default OnboardingSlide4;
