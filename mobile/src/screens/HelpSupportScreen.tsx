import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';

interface FAQItem {
  question: string;
  answer: string;
}

const HelpSupportScreen: React.FC = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqItems: FAQItem[] = [
    {
      question: 'How do I create a goal?',
      answer:
        'Tap the "+" button on the Home screen or navigate to My Goals and select "Create Goal". Our AI assistant will guide you through setting up your goal with clear success criteria and appropriate seed money.',
    },
    {
      question: 'What is seed money?',
      answer:
        'Seed money is the amount you commit when creating a goal. It\'s held in escrow and returned to you when you successfully complete your goal. If you don\'t complete your goal, it may be distributed to your supporters as a thank you for their accountability.',
    },
    {
      question: 'How does goal verification work?',
      answer:
        'When you submit proof of goal completion, our AI analyzes your evidence against the success criteria you defined. The AI determines whether you\'ve made progress, completed the goal, or if the submission is unrelated. You can submit multiple updates throughout your goal period.',
    },
    {
      question: 'How do I add money to my wallet?',
      answer:
        'Go to the Wallet tab and tap "Add Funds". Enter the amount you want to add and complete the payment using your credit or debit card. All payments are processed securely through Stripe.',
    },
    {
      question: 'How do I withdraw money from my wallet?',
      answer:
        'Navigate to the Wallet tab and tap "Withdraw". Enter the amount to withdraw and provide your bank account details. Withdrawals typically take 3-5 business days to process.',
    },
    {
      question: 'Can I invite friends to support my goals?',
      answer:
        'Yes! Each goal has a unique share code. Tap "Share Goal" on any goal detail screen to invite friends. They can contribute to your goal\'s pot and help hold you accountable.',
    },
    {
      question: 'What happens if I don\'t complete my goal?',
      answer:
        'If the deadline passes without successful verification, your goal is marked as failed. Your seed money is distributed proportionally to supporters who contributed to your goal. If there are no supporters, the seed money remains in your wallet minus platform fees.',
    },
    {
      question: 'What is the platform fee?',
      answer:
        'StakeUp charges a 5% platform fee on successful goal payouts. This fee helps us maintain the service, improve AI verification, and develop new features. There are no fees for failed goals.',
    },
    {
      question: 'Can I edit my goal after creating it?',
      answer:
        'You can edit goal details within 24 hours of creation, as long as no supporters have joined yet. After this window, goals cannot be modified to ensure fairness to all participants.',
    },
    {
      question: 'How do I change my notification settings?',
      answer:
        'Go to Profile > Reminder Settings to configure when and how often you receive goal reminders. You can set default preferences that apply to all goals, or customize settings for individual goals.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@stakeupai.com?subject=StakeUp Support Request');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>❓</Text>
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.subtitle}>
          Find answers to common questions or contact us for help
        </Text>
      </View>

      {/* FAQ Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {faqItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqItem}
            onPress={() => toggleFAQ(index)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.faqToggle}>
                {expandedIndex === index ? '−' : '+'}
              </Text>
            </View>
            {expandedIndex === index && (
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Contact Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        
        <View style={styles.contactCard}>
          <Text style={styles.contactIcon}>📧</Text>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>Email Support</Text>
            <Text style={styles.contactValue}>support@stakeupai.com</Text>
            <Text style={styles.contactNote}>
              We typically respond within 24-48 hours
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.emailButton} onPress={handleEmailSupport}>
          <Text style={styles.emailButtonText}>Send Email</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Tips</Text>
        
        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            Set specific, measurable goals with clear success criteria for better
            AI verification results.
          </Text>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>📸</Text>
          <Text style={styles.tipText}>
            When submitting verification, include clear photos or detailed
            descriptions that match your goal criteria.
          </Text>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>👥</Text>
          <Text style={styles.tipText}>
            Invite friends to your goals! Social accountability significantly
            increases goal completion rates.
          </Text>
        </View>
      </View>

      {/* App Version */}
      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>StakeUp v1.0.0</Text>
        <Text style={styles.versionSubtext}>Made with ❤️ for goal achievers</Text>
      </View>
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
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#F9FAFB',
    marginRight: 12,
  },
  faqToggle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#6366F1',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 22,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  contactCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  contactIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  contactNote: {
    fontSize: 12,
    color: '#6B7280',
  },
  emailButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  tipIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#93C5FD',
    lineHeight: 20,
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  versionSubtext: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
  },
});

export default HelpSupportScreen;

