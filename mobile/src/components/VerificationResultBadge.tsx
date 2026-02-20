import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';

export type VerificationStatus = 'not_related' | 'progress' | 'completed';

interface VerificationResultBadgeProps {
  status: VerificationStatus;
  confidence?: number;
  compact?: boolean;
}

export const VerificationResultBadge: React.FC<VerificationResultBadgeProps> = ({
  status,
  confidence,
  compact = false,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const getStatusConfig = () => {
    switch (status) {
      case 'not_related':
        return {
          emoji: '🤔',
          label: 'Not Related',
          backgroundColor: theme.colors.errorBg,
          borderColor: theme.colors.danger,
          textColor: theme.isDark ? '#FCA5A5' : theme.colors.danger,
        };
      case 'progress':
        return {
          emoji: '📈',
          label: 'Good Progress',
          backgroundColor: theme.colors.warningBg,
          borderColor: theme.colors.secondary,
          textColor: theme.isDark ? '#FCD34D' : theme.colors.secondary,
        };
      case 'completed':
        return {
          emoji: '🎉',
          label: 'Completed',
          backgroundColor: theme.colors.successBg,
          borderColor: theme.colors.success,
          textColor: theme.isDark ? '#6EE7B7' : theme.colors.success,
        };
      default:
        return {
          emoji: '📈',
          label: 'Good Progress',
          backgroundColor: theme.colors.warningBg,
          borderColor: theme.colors.secondary,
          textColor: theme.isDark ? '#FCD34D' : theme.colors.secondary,
        };
    }
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: config.backgroundColor, borderColor: config.borderColor }]}>
        <Text style={styles.compactEmoji}>{config.emoji}</Text>
        <Text style={[styles.compactLabel, { color: config.textColor }]}>{config.label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor, borderColor: config.borderColor }]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{config.emoji}</Text>
        <Text style={[styles.label, { color: config.textColor }]}>{config.label}</Text>
      </View>
      {confidence !== undefined && (
        <View style={styles.confidenceContainer}>
          <View style={styles.confidenceBar}>
            <View 
              style={[
                styles.confidenceFill, 
                { 
                  width: `${confidence}%`,
                  backgroundColor: config.borderColor 
                }
              ]} 
            />
          </View>
          <Text style={[styles.confidenceText, { color: config.textColor }]}>
            {confidence}% confident
          </Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 20,
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  confidenceContainer: {
    marginTop: 8,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
    opacity: 0.8,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  compactEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  compactLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
});

export default VerificationResultBadge;
