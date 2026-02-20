import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

const PrivacySecurityScreen: React.FC = () => {
  const sections = [
    {
      title: '1. Information We Collect',
      content: `We collect information you provide directly to us, including:

• Account information (name, email address)
• Profile information you choose to add
• Goal and achievement data
• Payment information (processed securely through Stripe)
• Communications with us

We automatically collect certain information when you use StakeUp:

• Device information (device type, operating system)
• Usage data (features used, goals created)
• Log data (access times, pages viewed)`,
    },
    {
      title: '2. How We Use Your Information',
      content: `We use the information we collect to:

• Provide, maintain, and improve our services
• Process transactions and send related information
• Send you technical notices and support messages
• Respond to your comments and questions
• Monitor and analyze trends and usage
• Detect, investigate, and prevent fraudulent transactions
• Personalize and improve your experience`,
    },
    {
      title: '3. Information Sharing',
      content: `We do not sell your personal information. We may share information:

• With your consent or at your direction
• With service providers who assist in our operations
• To comply with legal obligations
• To protect our rights, privacy, safety, or property
• In connection with a merger, acquisition, or sale of assets

Goal progress and achievements may be visible to other participants you've invited.`,
    },
    {
      title: '4. Data Security',
      content: `We implement appropriate security measures to protect your information:

• Encryption of data in transit and at rest
• Secure payment processing through Stripe
• Regular security assessments and updates
• Access controls and authentication
• Secure data storage practices

While we strive to protect your information, no method of transmission over the Internet is 100% secure.`,
    },
    {
      title: '5. Your Rights and Choices',
      content: `You have the right to:

• Access your personal information
• Correct inaccurate information
• Delete your account and associated data
• Opt out of promotional communications
• Export your data

To exercise these rights, contact us at support@stakeupai.com`,
    },
    {
      title: '6. Data Retention',
      content: `We retain your information for as long as your account is active or as needed to provide services. We may retain certain information for:

• Legal compliance requirements
• Dispute resolution
• Enforcement of our agreements

You can request deletion of your account at any time.`,
    },
    {
      title: '7. Children\'s Privacy',
      content: `StakeUp is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it promptly.`,
    },
    {
      title: '8. Changes to This Policy',
      content: `We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.

Continued use of StakeUp after changes constitutes acceptance of the updated policy.`,
    },
    {
      title: '9. Contact Us',
      content: `If you have questions about this Privacy Policy or our privacy practices, please contact us:

Email: support@stakeupai.com

We will respond to your inquiry within a reasonable timeframe.`,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🔒</Text>
        <Text style={styles.title}>Privacy & Security</Text>
        <Text style={styles.lastUpdated}>Last Updated: January 2026</Text>
      </View>

      {/* Introduction */}
      <View style={styles.introCard}>
        <Text style={styles.introText}>
          Your privacy is important to us. This policy describes how StakeUp
          collects, uses, and protects your personal information.
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

export default PrivacySecurityScreen;

