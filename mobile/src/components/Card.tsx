import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  style,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const getVariantStyle = () => {
    switch (variant) {
      case 'default':
        return styles.default;
      case 'elevated':
        return styles.elevated;
      case 'outlined':
        return styles.outlined;
      default:
        return styles.default;
    }
  };

  const getPaddingStyle = () => {
    switch (padding) {
      case 'none':
        return styles.padding_none;
      case 'small':
        return styles.padding_small;
      case 'medium':
        return styles.padding_medium;
      case 'large':
        return styles.padding_large;
      default:
        return styles.padding_medium;
    }
  };

  return (
    <View
      style={[
        styles.card,
        getVariantStyle(),
        getPaddingStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.card,
  },
  // Variants
  default: {
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  elevated: {
    ...theme.shadows.cardElevated,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: theme.isDark ? 2 : 1,
    borderColor: theme.colors.border,
  },
  // Padding
  padding_none: {
    padding: 0,
  },
  padding_small: {
    padding: 12,
  },
  padding_medium: {
    padding: 16,
  },
  padding_large: {
    padding: 24,
  },
});

export default Card;
