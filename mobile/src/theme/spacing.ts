/**
 * Spacing, Border Radius, and Shadow Configuration
 * 
 * Dark Mode: Softer, larger radius for modern tech feel
 * Light Mode: Sharper, smaller radius for formal banking feel
 */

import { ViewStyle } from 'react-native';

// Base spacing scale (4px increments)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

// Dark mode border radius
export const darkBorderRadius = {
  // Buttons & Inputs - softer
  button: 12,
  input: 12,
  chip: 16,
  
  // Cards & Modals - larger
  card: 20,
  cardSmall: 16,
  modal: 24,
  
  // Special
  avatar: 40, // Full circle for 80px avatar
  badge: 6,
  pill: 20,
  fab: 28,
};

// Light mode border radius (sharper for formal look)
export const lightBorderRadius = {
  // Buttons & Inputs - sharper
  button: 8,
  input: 8,
  chip: 12,
  
  // Cards & Modals - slightly smaller
  card: 16,
  cardSmall: 12,
  modal: 20,
  
  // Special
  avatar: 40,
  badge: 4,
  pill: 16,
  fab: 24,
};

// Dark mode shadows (soft black, high blur)
export const darkShadows = {
  card: {
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  } as ViewStyle,
  
  cardElevated: {
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  } as ViewStyle,
  
  button: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,
  
  fab: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  } as ViewStyle,
  
  modal: {
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 16,
  } as ViewStyle,
  
  none: {} as ViewStyle,
};

// Light mode shadows (paper-like, subtle)
export const lightShadows = {
  card: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  } as ViewStyle,
  
  cardElevated: {
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  } as ViewStyle,
  
  button: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,
  
  fab: {
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  } as ViewStyle,
  
  modal: {
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  } as ViewStyle,
  
  none: {} as ViewStyle,
};

export type BorderRadius = typeof darkBorderRadius;
export type Shadows = typeof darkShadows;


