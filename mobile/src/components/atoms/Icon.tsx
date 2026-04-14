import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING } from '../../constants/config';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  name: string;
  size?: IconSize;
  color?: string;
  style?: ViewStyle;
  provider?: 'emoji' | 'text';
}

// Predefined icon mappings using text/emoji
// In a real app, you'd use a library like @expo/vector-icons
const ICON_MAP: Record<string, string> = {
  // Navigation
  'arrow-left': '←',
  'arrow-right': '→',
  'arrow-back': '←',
  'arrow-forward': '→',
  'chevron-left': '‹',
  'chevron-right': '›',
  'chevron-down': '⌄',
  'chevron-up': '⌃',
  
  // Actions
  'eye': '👁',
  'eye-off': '👁‍🗨',
  'search': '🔍',
  'settings': '⚙',
  'check': '✓',
  'close': '✕',
  'plus': '+',
  'minus': '−',
  'edit': '✎',
  'delete': '🗑',
  'share': '↗',
  'download': '↓',
  
  // Social
  'google': 'G',
  'facebook': 'f',
  'apple': '',
  'email': '✉',
  'phone': '📞',
  'message': '💬',
  
  // User
  'user': '👤',
  'user-plus': '👤+',
  'users': '👥',
  'profile': '👤',
  
  // Professional
  'tool': '🔧',
  'wrench': '🔧',
  'hammer': '🔨',
  'paint': '🎨',
  'electrical': '⚡',
  'plumbing': '🚿',
  'cleaning': '🧹',
  'moving': '📦',
  
  // Misc
  'star': '★',
  'star-outline': '☆',
  'heart': '♥',
  'heart-outline': '♡',
  'location': '📍',
  'calendar': '📅',
  'clock': '🕐',
  'document': '📄',
  'image': '🖼',
  'camera': '📷',
  'lock': '🔒',
  'unlock': '🔓',
  'home': '🏠',
  'menu': '☰',
  'filter': '⚙',
  'sort': '↕',
  'alert': '⚠',
  'info': 'ℹ',
  'help': '?',
  'success': '✓',
  'error': '✕',
  'warning': '⚠',
};

const SIZE_MAP: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = COLORS.gray700,
  style,
  provider = 'text',
}) => {
  const iconSize = SIZE_MAP[size];
  
  // Get icon character from map
  const getIconContent = () => {
    if (provider === 'emoji') {
      // For emoji provider, use the name directly as emoji
      return name;
    }
    return ICON_MAP[name] || name.charAt(0).toUpperCase();
  };

  return (
    <View style={[styles.container, { width: iconSize, height: iconSize }, style]}>
      <Text style={[styles.icon, { fontSize: iconSize, color }]}>
        {getIconContent()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    textAlign: 'center',
  },
});

export default Icon;
