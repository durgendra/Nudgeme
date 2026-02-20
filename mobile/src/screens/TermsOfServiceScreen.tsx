import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

const TermsOfServiceScreen: React.FC = () => {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: `By accessing or using StakeUp, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.

These terms apply to all users, including goal creators, participants, and supporters.`,
    },
    {
      title: '2. Description of Service',
      content: `StakeUp is a goal accountability platform that allows users to:

• Create personal goals with financial stakes
• Invite friends and supporters to hold them accountable
• Submit proof of goal completion for AI verification
• Earn back seed money upon successful goal completion

The service is designed to motivate achievement through social accountability and financial incentives.`,
    },
    {
      title: '3. User Accounts',
      content: `To use StakeUp, you must:

• Be at least 18 years old
• Provide accurate and complete registration information
• Maintain the security of your account credentials
• Notify us immediately of any unauthorized access

You are responsible for all activities under your account.`,
    },
    {
      title: '4. Financial Terms',
      content: `Goal Creation and Seed Money:
• When creating a goal, you commit "seed money" from your wallet
• Seed money is held until goal completion or deadline
• Upon successful verification, seed money is returned to you
• Upon failure, seed money may be distributed to supporters

Platform Fees:
• A platform fee of 5% applies to successful goal payouts
• Fees are deducted automatically from the payout
• Fee percentages may be updated with prior notice

Refunds:
• Funds added to your wallet are non-refundable
• Wallet balance can be withdrawn to your bank account
• Withdrawal processing may take 3-5 business days`,
    },
    {
      title: '5. Goal Verification',
      content: `Goal completion is verified through our AI-powered system:

• You must submit valid proof of completion
• AI verification analyzes submitted evidence
• Verification results are based on objective criteria
• Some goals may require manual review

We reserve the right to:
• Request additional verification evidence
• Override AI verification decisions in cases of fraud
• Reject goals that violate our content policies`,
    },
    {
      title: '6. User Conduct',
      content: `You agree not to:

• Create fraudulent or misleading goals
• Submit false or manipulated verification evidence
• Harass, abuse, or harm other users
• Use the service for illegal activities
• Attempt to circumvent platform security
• Create multiple accounts to abuse promotions
• Share account credentials with others

Violation of these rules may result in account suspension or termination.`,
    },
    {
      title: '7. Content and Intellectual Property',
      content: `Your Content:
• You retain ownership of content you submit
• You grant us a license to use, display, and distribute your content for service operation
• You are responsible for ensuring your content doesn't infringe on others' rights

Our Content:
• StakeUp's logos, designs, and features are our property
• You may not copy, modify, or distribute our content without permission`,
    },
    {
      title: '8. Limitation of Liability',
      content: `To the maximum extent permitted by law:

• StakeUp is provided "as is" without warranties
• We are not liable for indirect, incidental, or consequential damages
• Our total liability is limited to the amount you paid us in the past 12 months
• We are not responsible for third-party services or content

This limitation applies regardless of the cause of action.`,
    },
    {
      title: '9. Indemnification',
      content: `You agree to indemnify and hold harmless StakeUp, its officers, directors, employees, and agents from any claims, damages, or expenses arising from:

• Your use of the service
• Your violation of these terms
• Your violation of any rights of another
• Your submitted content`,
    },
    {
      title: '10. Modifications to Service',
      content: `We reserve the right to:

• Modify or discontinue features with or without notice
• Change pricing with reasonable notice
• Update these terms at any time

Continued use after changes constitutes acceptance. Material changes will be communicated via email or in-app notification.`,
    },
    {
      title: '11. Termination',
      content: `You may close your account at any time through the app.

We may suspend or terminate your account for:
• Violation of these terms
• Fraudulent activity
• Extended inactivity (2+ years)

Upon termination, your right to use StakeUp ends. Wallet balances will be handled according to our withdrawal policy.`,
    },
    {
      title: '12. Governing Law',
      content: `These terms are governed by the laws of the State of California, United States, without regard to conflict of law principles.

Any disputes shall be resolved through binding arbitration in San Francisco, California, except where prohibited by law.`,
    },
    {
      title: '13. Contact Information',
      content: `For questions about these Terms of Service:

Email: legal@stakeupai.com

We will respond to inquiries within a reasonable timeframe.`,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📜</Text>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.lastUpdated}>Last Updated: January 2026</Text>
      </View>

      {/* Introduction */}
      <View style={styles.introCard}>
        <Text style={styles.introText}>
          Please read these Terms of Service carefully before using StakeUp.
          These terms govern your use of our goal accountability platform.
        </Text>
      </View>

      {/* Sections */}
      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionContent}>{section.content}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#6B7280',
  },
  introCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  introText: {
    fontSize: 15,
    color: '#93C5FD',
    lineHeight: 22,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 22,
  },
});

export default TermsOfServiceScreen;

