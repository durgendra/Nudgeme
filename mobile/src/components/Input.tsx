import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../store/ThemeContext';
import { Theme } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: string;
  containerStyle?: ViewStyle;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  leftIcon,
  containerStyle,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {leftIcon && <Text style={styles.leftIcon}>{leftIcon}</Text>}
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithIcon, style]}
          placeholderTextColor={theme.colors.textMuted}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helper && !error && <Text style={styles.helperText}>{helper}</Text>}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: theme.isDark ? '#D1D5DB' : theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  leftIcon: {
    fontSize: 20,
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  inputWithIcon: {
    paddingLeft: 12,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
});

export default Input;
