import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../store/ThemeContext';
import { Theme } from '../../theme';
import { socialProofData } from '../../utils/onboarding';

const { width } = Dimensions.get('window');

const OnboardingSlide1: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Logo and Brand */}
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>🎯</Text>
        <Text style={styles.brandName}>StakeUp</Text>
      </View>

      {/* Main Value Proposition */}
      <View style={styles.contentContainer}>
        <Text style={styles.headline}>
          Achieve Your Goals{'\n'}With Financial Accountability
        </Text>
        
        <Text style={styles.subheadline}>
          Put your money where your goals are. Create commitments, invite supporters, and get rewarded for success.
        </Text>
      </View>

      {/* Social Proof Banner */}
      <View style={styles.socialProofContainer}>
        <View style={styles.socialProofBadge}>
          <Text style={styles.socialProofIcon}>👥</Text>
          <Text style={styles.socialProofText}>
            <Text style={styles.socialProofHighlight}>{socialProofData.totalUsers}</Text> committed to achieving their goals
          </Text>
        </View>
      </View>

      {/* Research Citation */}
      <View style={styles.researchContainer}>
        <Text style={styles.researchIcon}>📊</Text>
        <Text style={styles.researchText}>
          Research shows people with financial stakes are{' '}
          <Text style={styles.researchHighlight}>3x more likely</Text> to follow through on commitments
        </Text>
      </View>

      {/* Decorative Elements */}
      <View style={styles.decorativeContainer}>
        <View style={[styles.decorativeCircle, styles.circle1]} />
        <View style={[styles.decorativeCircle, styles.circle2]} />
        <View style={[styles.decorativeCircle, styles.circle3]} />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    width,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 80,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headline: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
  },
  subheadline: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 12,
  },
  socialProofContainer: {
    marginBottom: 32,
    width: '100%',
  },
  socialProofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)',
  },
  socialProofIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  socialProofText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
  },
  socialProofHighlight: {
    color: '#6366F1',
    fontFamily: 'Inter-Bold',
  },
  researchContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  researchIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  researchText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  researchHighlight: {
    color: theme.colors.success,
    fontFamily: 'Inter-Bold',
  },
  decorativeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: theme.isDark ? 0.1 : 0.15,
  },
  circle1: {
    width: 200,
    height: 200,
    backgroundColor: '#6366F1',
    top: -50,
    right: -80,
  },
  circle2: {
    width: 150,
    height: 150,
    backgroundColor: theme.colors.success,
    bottom: 100,
    left: -60,
  },
  circle3: {
    width: 100,
    height: 100,
    backgroundColor: theme.colors.warning,
    bottom: 200,
    right: -30,
  },
});

export default OnboardingSlide1;
