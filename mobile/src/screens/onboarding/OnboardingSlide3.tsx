import React from "react";
import { View, Text, StyleSheet, Dimensions, ScrollView } from "react-native";
import { useTheme } from "../../store/ThemeContext";
import { Theme } from "../../theme";
import { socialProofData } from "../../utils/onboarding";

const { width } = Dimensions.get("window");

interface TestimonialCardProps {
  avatar: string;
  name: string;
  location: string;
  quote: string;
  theme: Theme;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
  avatar,
  name,
  location,
  quote,
  theme,
}) => {
  const styles = createTestimonialStyles(theme);

  return (
    <View style={styles.testimonialCard}>
      <View style={styles.testimonialHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatar}>{avatar}</Text>
        </View>
        <View style={styles.testimonialInfo}>
          <Text style={styles.testimonialName}>{name}</Text>
          <Text style={styles.testimonialLocation}>{location}</Text>
        </View>
      </View>
      <View style={styles.quoteContainer}>
        <Text style={styles.quoteIcon}>"</Text>
        <Text style={styles.testimonialQuote}>{quote}</Text>
      </View>
    </View>
  );
};

interface ResearchCardProps {
  stat: string;
  description: string;
  source: string;
  theme: Theme;
}

const ResearchCard: React.FC<ResearchCardProps> = ({
  stat,
  description,
  source,
  theme,
}) => {
  const styles = createResearchStyles(theme);

  return (
    <View style={styles.researchCard}>
      <Text style={styles.researchStat}>{stat}</Text>
      <Text style={styles.researchDescription}>{description}</Text>
      <Text style={styles.researchSource}>— {source}</Text>
    </View>
  );
};

const OnboardingSlide3: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Backed by Science</Text>
        <Text style={styles.headerSubtitle}>Research-backed approach</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{socialProofData.successRate}</Text>
          <Text style={styles.statLabel}>Success Rate</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHighlight]}>
          <Text style={[styles.statValue, styles.statValueHighlight]}>
            {socialProofData.totalUsers}
          </Text>
          <Text style={styles.statLabel}>Join Today</Text>
        </View>
      </View>

      {/* Research Highlights */}
      <View style={styles.researchContainer}>
        <Text style={styles.researchTitle}>📚 Research Highlights</Text>
        <View style={styles.researchGrid}>
          {socialProofData.researchHighlights
            .slice(0, 2)
            .map((research, index) => (
              <ResearchCard
                key={index}
                stat={research.stat}
                description={research.description}
                source={research.source}
                theme={theme}
              />
            ))}
        </View>
      </View>

      {/* Testimonials - Vertical Scrollable */}
      <View style={styles.testimonialsSection}>
        <Text style={styles.testimonialsTitle}>💬 What Users Say</Text>
        <ScrollView
          style={styles.testimonialsScrollView}
          contentContainerStyle={styles.testimonialsContent}
          showsVerticalScrollIndicator={false}
        >
          {socialProofData.testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              avatar={testimonial.avatar}
              name={testimonial.name}
              location={testimonial.location}
              quote={testimonial.quote}
              theme={theme}
            />
          ))}
        </ScrollView>
      </View>

      {/* Trust Badges */}
      <View style={styles.trustContainer}>
        <View style={styles.trustBadge}>
          <Text style={styles.trustIcon}>🔒</Text>
          <Text style={styles.trustText}>Secure Payments</Text>
        </View>
        <View style={styles.trustBadge}>
          <Text style={styles.trustIcon}>🤖</Text>
          <Text style={styles.trustText}>AI Verification</Text>
        </View>
        <View style={styles.trustBadge}>
          <Text style={styles.trustIcon}>💳</Text>
          <Text style={styles.trustText}>Stripe Protected</Text>
        </View>
      </View>
    </View>
  );
};

const createTestimonialStyles = (theme: Theme) =>
  StyleSheet.create({
    testimonialCard: {
      width: "100%",
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    testimonialHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    avatarContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.isDark ? "#374151" : "#E5E7EB",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    avatar: {
      fontSize: 24,
    },
    testimonialInfo: {
      flex: 1,
    },
    testimonialName: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: theme.colors.textPrimary,
      marginBottom: 2,
      lineHeight: 20,
    },
    testimonialLocation: {
      fontSize: 13,
      fontFamily: "Inter-Regular",
      color: theme.colors.textMuted,
      lineHeight: 16,
    },
    quoteContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    quoteIcon: {
      fontSize: 32,
      color: "#6366F1",
      opacity: 0.3,
      fontFamily: "Inter-Bold",
      lineHeight: 24,
      marginRight: 6,
      marginTop: -4,
    },
    testimonialQuote: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter-Regular",
      color: theme.colors.textSecondary,
      lineHeight: 22,
      fontStyle: "italic",
    },
  });

const createResearchStyles = (theme: Theme) =>
  StyleSheet.create({
    researchCard: {
      flex: 1,
      backgroundColor: theme.isDark
        ? "rgba(16, 185, 129, 0.1)"
        : "rgba(5, 150, 105, 0.1)",
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.isDark
        ? "rgba(16, 185, 129, 0.2)"
        : "rgba(5, 150, 105, 0.2)",
    },
    researchStat: {
      fontSize: 24,
      fontFamily: "Inter-Bold",
      color: theme.colors.success,
      marginBottom: 4,
    },
    researchDescription: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: theme.colors.textSecondary,
      lineHeight: 16,
      marginBottom: 6,
    },
    researchSource: {
      fontSize: 10,
      fontFamily: "Inter-Regular",
      color: theme.colors.textMuted,
      fontStyle: "italic",
    },
  });

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width,
      backgroundColor: theme.colors.background,
      paddingTop: 60,
    },
    headerContainer: {
      alignItems: "center",
      marginBottom: 24,
      paddingHorizontal: 24,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: "Inter-Bold",
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      fontFamily: "Inter-Regular",
      color: theme.colors.textSecondary,
    },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statCardHighlight: {
      backgroundColor: theme.isDark
        ? "rgba(99, 102, 241, 0.15)"
        : "rgba(99, 102, 241, 0.1)",
      borderColor: theme.isDark
        ? "rgba(99, 102, 241, 0.3)"
        : "rgba(99, 102, 241, 0.2)",
    },
    statValue: {
      fontSize: 32,
      fontFamily: "Inter-Bold",
      color: theme.colors.success,
      marginBottom: 4,
    },
    statValueHighlight: {
      color: "#6366F1",
    },
    statLabel: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: theme.colors.textSecondary,
    },
    testimonialsSection: {
      flex: 1,
      paddingHorizontal: 24,
      marginTop: 20,
      marginBottom: 20,
    },
    testimonialsTitle: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: theme.colors.textPrimary,
      marginBottom: 12,
    },
    testimonialsScrollView: {
      flex: 1,
    },
    testimonialsContent: {
      gap: 16,
      paddingBottom: 8,
    },
    researchContainer: {
      paddingHorizontal: 24,
      marginTop: 20,
      marginBottom: 20,
    },
    researchTitle: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: theme.colors.textPrimary,
      marginBottom: 12,
    },
    researchGrid: {
      flexDirection: "row",
      gap: 12,
    },
    trustContainer: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 16,
      paddingHorizontal: 24,
    },
    trustBadge: {
      alignItems: "center",
      gap: 4,
    },
    trustIcon: {
      fontSize: 24,
    },
    trustText: {
      fontSize: 11,
      fontFamily: "Inter-SemiBold",
      color: theme.colors.textMuted,
    },
  });

export default OnboardingSlide3;
