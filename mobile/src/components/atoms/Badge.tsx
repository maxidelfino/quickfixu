import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SPACING } from '../../constants/config';

interface BadgeProps {
  count?: number;
  label?: string;
  variant?: 'primary' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const Badge: React.FC<BadgeProps> = ({
  count,
  label,
  variant = 'primary',
  size = 'sm',
  style,
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'accent':
        return COLORS.accent;
      case 'success':
        return COLORS.success;
      case 'warning':
        return COLORS.warning;
      case 'error':
        return COLORS.error;
      default:
        return COLORS.primary;
    }
  };

  const getSizeStyles = () => {
    if (size === 'md') {
      return {
        minWidth: 24,
        height: 24,
        paddingHorizontal: SPACING.sm,
        fontSize: FONT_SIZE.sm,
      };
    }
    return {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      fontSize: FONT_SIZE.xs,
    };
  };

  const sizeStyles = getSizeStyles();

  const content = count !== undefined ? (
    <Text style={[styles.text, { fontSize: sizeStyles.fontSize }]}>
      {count > 99 ? '99+' : count}
    </Text>
  ) : label ? (
    <Text style={[styles.text, { fontSize: sizeStyles.fontSize }]}>{label}</Text>
  ) : null;

  if (!content) return null;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getBackgroundColor(),
          minWidth: sizeStyles.minWidth,
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        style,
      ]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.bold,
  },
});

export default Badge;
