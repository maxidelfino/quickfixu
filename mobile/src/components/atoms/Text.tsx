import React from 'react';
import { Text as RNText, TextStyle, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySmall' | 'caption' | 'label';
export type TextColor = 'primary' | 'accent' | 'error' | 'success' | 'warning' | 'light' | 'muted' | 'white';

interface TextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle;
  numberOfLines?: number;
  onPress?: () => void;
  disabled?: boolean;
}

const Text: React.FC<TextProps> = ({
  children,
  variant = 'body',
  color,
  align = 'left',
  style,
  numberOfLines,
  onPress,
  disabled = false,
}) => {
  const getVariantStyle = (): TextStyle => {
    switch (variant) {
      case 'h1':
        return styles.h1;
      case 'h2':
        return styles.h2;
      case 'h3':
        return styles.h3;
      case 'h4':
        return styles.h4;
      case 'bodySmall':
        return styles.bodySmall;
      case 'caption':
        return styles.caption;
      case 'label':
        return styles.label;
      case 'body':
      default:
        return styles.body;
    }
  };

  const getColorStyle = (): TextStyle | null => {
    if (!color) return null;
    switch (color) {
      case 'primary':
        return { color: COLORS.primary };
      case 'accent':
        return { color: COLORS.accent };
      case 'error':
        return { color: COLORS.error };
      case 'success':
        return { color: COLORS.success };
      case 'warning':
        return { color: COLORS.warning };
      case 'light':
        return { color: COLORS.white };
      case 'muted':
        return { color: COLORS.gray500 };
      case 'white':
        return { color: COLORS.white };
      default:
        return null;
    }
  };

  const textStyle = [
    getVariantStyle(),
    { textAlign: align },
    getColorStyle(),
    disabled && styles.disabled,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7}>
        <RNText style={textStyle} numberOfLines={numberOfLines}>
          {children}
        </RNText>
      </TouchableOpacity>
    );
  }

  return (
    <RNText style={textStyle} numberOfLines={numberOfLines}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    lineHeight: FONT_SIZE.xxxl * 1.2,
  },
  h2: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    lineHeight: FONT_SIZE.xxl * 1.2,
  },
  h3: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    lineHeight: FONT_SIZE.xl * 1.3,
  },
  h4: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    lineHeight: FONT_SIZE.lg * 1.3,
  },
  body: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.gray800,
    lineHeight: FONT_SIZE.md * 1.5,
  },
  bodySmall: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.gray700,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  caption: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.gray500,
    lineHeight: FONT_SIZE.xs * 1.4,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray700,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Text;
