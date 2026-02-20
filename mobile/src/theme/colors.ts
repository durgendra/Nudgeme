/**
 * Color Palettes for Dual Theme System
 * 
 * High-Performance Dark Theme - Technical, precise feel
 * Clean FinTech Light Theme - Premium banking feel
 */

// Dark Theme: High-Performance Dark
export const darkColors = {
  // Backgrounds
  background: '#0F172A',      // Midnight Navy - Main screen background
  surface: '#1E293B',         // Slate Blue - Cards, inputs, modals
  surfaceElevated: '#334155', // Elevated surface for nested elements
  
  // Actions
  primary: '#10B981',         // Emerald Green - Success, Complete, Confirm
  primaryDark: '#059669',     // Darker emerald for pressed states
  secondary: '#F59E0B',       // Amber Orange - Stake Money, Urgent, Challenge
  secondaryDark: '#D97706',   // Darker amber for pressed states
  danger: '#EF4444',          // Rose Red - Delete, Fail, Cancel
  dangerDark: '#DC2626',      // Darker red for pressed states
  
  // Text
  textPrimary: '#F8FAFC',     // Ghost White - Headlines, primary body
  textSecondary: '#94A3B8',   // Slate Gray - Labels, descriptions, timestamps
  textMuted: '#64748B',       // Muted text
  textInverse: '#0F172A',     // For text on light backgrounds (buttons)
  
  // Borders & Dividers
  border: '#334155',          // Deep Slate - Card borders, separators
  borderLight: '#475569',     // Lighter border for emphasis
  
  // Status Colors
  success: '#10B981',         // Emerald
  successBg: '#065F46',       // Success background
  warning: '#F59E0B',         // Amber
  warningBg: '#78350F',       // Warning background
  error: '#EF4444',           // Rose
  errorBg: '#7F1D1D',         // Error background
  info: '#3B82F6',            // Blue
  infoBg: '#1E3A5F',          // Info background
  
  // Special
  overlay: 'rgba(0, 0, 0, 0.7)',
  glow: 'rgba(16, 185, 129, 0.3)', // Emerald glow
  
  // Wallet Card Gradient
  walletGradientStart: '#1E293B',
  walletGradientEnd: '#0F172A',
  
  // Progress Ring
  progressTrack: '#334155',
  progressFill: '#10B981',
  
  // Tab Bar
  tabBarBg: '#0F172A',
  tabBarBorder: '#334155',
  tabBarActive: '#10B981',
  tabBarInactive: '#94A3B8',
};

// Light Theme: Clean FinTech
export const lightColors = {
  // Backgrounds
  background: '#F8FAFC',      // Slate White - Crisp, clean canvas
  surface: '#FFFFFF',         // Pure White - Cards lifted with shadows
  surfaceElevated: '#F1F5F9', // Light gray for nested elements
  
  // Actions
  primary: '#059669',         // Forest Green - Banking-safe success
  primaryDark: '#047857',     // Darker forest for pressed states
  secondary: '#D97706',       // Golden Ochre - Professional stake color
  secondaryDark: '#B45309',   // Darker ochre for pressed states
  danger: '#DC2626',          // Crimson - Errors, missed goals
  dangerDark: '#B91C1C',      // Darker crimson for pressed states
  
  // Text
  textPrimary: '#0F172A',     // Deep Navy - Highest readability
  textSecondary: '#64748B',   // Cool Gray - Secondary labels
  textMuted: '#94A3B8',       // Muted text
  textInverse: '#FFFFFF',     // For text on dark backgrounds (buttons)
  
  // Borders & Dividers
  border: '#E2E8F0',          // Light Slate - Subtle hairline borders
  borderLight: '#CBD5E1',     // Slightly darker for emphasis
  
  // Status Colors
  success: '#059669',         // Forest Green
  successBg: '#D1FAE5',       // Light green background
  warning: '#D97706',         // Golden Ochre
  warningBg: '#FEF3C7',       // Light amber background
  error: '#DC2626',           // Crimson
  errorBg: '#FEE2E2',         // Light red background
  info: '#2563EB',            // Blue
  infoBg: '#DBEAFE',          // Light blue background
  
  // Special
  overlay: 'rgba(0, 0, 0, 0.5)',
  glow: 'rgba(5, 150, 105, 0.2)', // Forest glow
  
  // Wallet Card Gradient (contrast pop in light mode)
  walletGradientStart: '#1E293B',
  walletGradientEnd: '#334155',
  
  // Progress Ring
  progressTrack: '#F1F5F9',
  progressFill: '#059669',
  
  // Tab Bar
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#059669',
  tabBarInactive: '#64748B',
};

export type ColorPalette = typeof darkColors;


