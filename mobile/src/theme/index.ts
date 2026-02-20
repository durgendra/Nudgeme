/**
 * Theme System - Main Export
 * 
 * Provides complete theme objects for Dark and Light modes
 */

import { darkColors, lightColors, ColorPalette } from './colors';
import { darkTypography, lightTypography, Typography, fonts, fontSizes } from './typography';
import { 
  spacing, 
  darkBorderRadius, 
  lightBorderRadius, 
  darkShadows, 
  lightShadows,
  BorderRadius,
  Shadows 
} from './spacing';

// Theme type definition
export interface Theme {
  isDark: boolean;
  colors: ColorPalette;
  typography: Typography;
  borderRadius: BorderRadius;
  shadows: Shadows;
  spacing: typeof spacing;
}

// Dark Theme
export const darkTheme: Theme = {
  isDark: true,
  colors: darkColors,
  typography: darkTypography,
  borderRadius: darkBorderRadius,
  shadows: darkShadows,
  spacing,
};

// Light Theme
export const lightTheme: Theme = {
  isDark: false,
  colors: lightColors,
  typography: lightTypography,
  borderRadius: lightBorderRadius,
  shadows: lightShadows,
  spacing,
};

// Re-export everything
export { darkColors, lightColors } from './colors';
export { darkTypography, lightTypography, fonts, fontSizes } from './typography';
export { 
  spacing, 
  darkBorderRadius, 
  lightBorderRadius, 
  darkShadows, 
  lightShadows 
} from './spacing';

// Type exports
export type { ColorPalette } from './colors';
export type { Typography } from './typography';
export type { BorderRadius, Shadows } from './spacing';

// Default export
export default { darkTheme, lightTheme };


