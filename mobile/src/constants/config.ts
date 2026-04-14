// API Configuration
// For physical device testing: set EXPO_PUBLIC_API_URL in mobile/.env
// Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to get your machine's local IP
// Example: EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
import { Platform } from 'react-native';

const getApiUrl = (): string => {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envApiUrl) {
    return envApiUrl;
  }

  if (__DEV__) {
    // Android emulator MUST use 10.0.2.2 — it maps to host machine's localhost
    // Physical device should set EXPO_PUBLIC_API_URL to the machine's local IP
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    // iOS simulator can reach localhost directly
    return 'http://localhost:3000';
  }

  return 'https://api.quickfixu.com';
};

export const API_BASE_URL = getApiUrl();

// Log API URL on startup for debugging
if (__DEV__) {
  console.log('🔌 API_BASE_URL:', API_BASE_URL);
}

// Supabase Configuration
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bmncfixzsvpcxiwxhawh.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_-Em3jCfOEHUJjs9rSHxjjA_0RVvMXNM';

// App Configuration
export const APP_NAME = 'QuickFixU';

// Colors - QuickFixU Brand
export const COLORS = {
  // Brand Colors
  primary: '#1E40AF',
  primaryLight: '#3B82F6',
  primaryDark: '#1E3A8A',
  accent: '#F97316',
  accentLight: '#FB923C',
  accentDark: '#EA580C',
  
  // Neutrals
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Semantic (User specified)
  error: '#DC2626',
  success: '#16A34A',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Background (User specified)
  background: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E5E7EB',
  
  // Text (User specified)
  text: '#1F2937',
  textLight: '#6B7280',
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border Radius
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Typography
export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Font Weights
export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
