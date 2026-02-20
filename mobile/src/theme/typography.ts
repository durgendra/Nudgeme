/**
 * Typography Configuration for Dual Theme System
 * 
 * Dark Mode: Technical, precise feel with monospace for numbers
 * Light Mode: Premium banking feel with clean sans-serif
 */

import { TextStyle } from 'react-native';

// Font families
export const fonts = {
  // Headlines
  interBold: 'Inter-Bold',
  interSemiBold: 'Inter-SemiBold',
  
  // Body
  interRegular: 'Inter-Regular',
  interMedium: 'Inter-Medium',
  
  // Monospace (for dark mode money/timers)
  jetBrainsMono: 'JetBrainsMono-Regular',
  jetBrainsMonoBold: 'JetBrainsMono-Bold',
};

// Font sizes
export const fontSizes = {
  // Headlines
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  
  // Body
  bodyLarge: 16,
  body: 14,
  bodySmall: 13,
  
  // Labels & Captions
  label: 14,
  caption: 12,
  tiny: 11,
  micro: 10,
  
  // Special
  walletBalance: 36,
  statValue: 20,
  buttonText: 16,
};

// Line heights
export const lineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};

// Dark mode typography styles
export const darkTypography = {
  // Headlines use Inter Bold
  h1: {
    fontFamily: fonts.interBold,
    fontSize: fontSizes.h1,
    color: '#F8FAFC',
    lineHeight: fontSizes.h1 * lineHeights.tight,
  } as TextStyle,
  
  h2: {
    fontFamily: fonts.interBold,
    fontSize: fontSizes.h2,
    color: '#F8FAFC',
    lineHeight: fontSizes.h2 * lineHeights.tight,
  } as TextStyle,
  
  h3: {
    fontFamily: fonts.interBold,
    fontSize: fontSizes.h3,
    color: '#F8FAFC',
    lineHeight: fontSizes.h3 * lineHeights.tight,
  } as TextStyle,
  
  h4: {
    fontFamily: fonts.interBold,
    fontSize: fontSizes.h4,
    color: '#F8FAFC',
    lineHeight: fontSizes.h4 * lineHeights.normal,
  } as TextStyle,
  
  // Body uses Inter Regular
  body: {
    fontFamily: fonts.interRegular,
    fontSize: fontSizes.body,
    color: '#F8FAFC',
    lineHeight: fontSizes.body * lineHeights.relaxed,
  } as TextStyle,
  
  bodyMuted: {
    fontFamily: fonts.interRegular,
    fontSize: fontSizes.body,
    color: '#94A3B8',
    lineHeight: fontSizes.body * lineHeights.relaxed,
  } as TextStyle,
  
  // Labels
  label: {
    fontFamily: fonts.interMedium,
    fontSize: fontSizes.label,
    color: '#94A3B8',
  } as TextStyle,
  
  caption: {
    fontFamily: fonts.interRegular,
    fontSize: fontSizes.caption,
    color: '#64748B',
  } as TextStyle,
  
  // Monetary values use JetBrains Mono for technical feel
  money: {
    fontFamily: fonts.jetBrainsMono,
    fontSize: fontSizes.walletBalance,
    color: '#F8FAFC',
  } as TextStyle,
  
  moneySmall: {
    fontFamily: fonts.jetBrainsMono,
    fontSize: fontSizes.bodyLarge,
    color: '#F8FAFC',
  } as TextStyle,
  
  // Button text
  button: {
    fontFamily: fonts.interBold,
    fontSize: fontSizes.buttonText,
    color: '#F8FAFC',
  } as TextStyle,
};

// Light mode typography styles
export const lightTypography = {
  // Headlines use Inter SemiBold (slightly lighter than dark)
  h1: {
    fontFamily: fonts.interSemiBold,
    fontSize: 30, // Slightly smaller for light mode
    color: '#0F172A',
    lineHeight: 30 * lineHeights.tight,
  } as TextStyle,
  
  h2: {
    fontFamily: fonts.interSemiBold,
    fontSize: fontSizes.h2,
    color: '#0F172A',
    lineHeight: fontSizes.h2 * lineHeights.tight,
  } as TextStyle,
  
  h3: {
    fontFamily: fonts.interSemiBold,
    fontSize: fontSizes.h3,
    color: '#0F172A',
    lineHeight: fontSizes.h3 * lineHeights.tight,
  } as TextStyle,
  
  h4: {
    fontFamily: fonts.interSemiBold,
    fontSize: fontSizes.h4,
    color: '#0F172A',
    lineHeight: fontSizes.h4 * lineHeights.normal,
  } as TextStyle,
  
  // Body uses Inter Regular
  body: {
    fontFamily: fonts.interRegular,
    fontSize: fontSizes.body,
    color: '#1E293B',
    lineHeight: fontSizes.body * lineHeights.relaxed,
  } as TextStyle,
  
  bodyMuted: {
    fontFamily: fonts.interRegular,
    fontSize: fontSizes.body,
    color: '#64748B',
    lineHeight: fontSizes.body * lineHeights.relaxed,
  } as TextStyle,
  
  // Labels
  label: {
    fontFamily: fonts.interMedium,
    fontSize: fontSizes.label,
    color: '#64748B',
  } as TextStyle,
  
  caption: {
    fontFamily: fonts.interRegular,
    fontSize: fontSizes.caption,
    color: '#94A3B8',
  } as TextStyle,
  
  // Monetary values use Inter Medium (premium bank feel)
  money: {
    fontFamily: fonts.interMedium,
    fontSize: fontSizes.walletBalance,
    color: '#0F172A',
  } as TextStyle,
  
  moneySmall: {
    fontFamily: fonts.interMedium,
    fontSize: fontSizes.bodyLarge,
    color: '#0F172A',
  } as TextStyle,
  
  // Button text
  button: {
    fontFamily: fonts.interSemiBold,
    fontSize: fontSizes.buttonText,
    color: '#FFFFFF',
  } as TextStyle,
};

export type Typography = typeof darkTypography;


