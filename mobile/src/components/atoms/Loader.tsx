import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/config';

export type LoaderSize = 'sm' | 'md' | 'lg';
export type LoaderVariant = 'primary' | 'white' | 'accent';

interface LoaderProps {
  size?: LoaderSize;
  variant?: LoaderVariant;
  message?: string;
}

const SIZE_MAP: Record<LoaderSize, 'small' | 'default' | 'large'> = {
  sm: 'small',
  md: 'default',
  lg: 'large',
};

const COLOR_MAP: Record<LoaderVariant, string> = {
  primary: COLORS.primary,
  white: COLORS.white,
  accent: COLORS.accent,
};

const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  variant = 'primary',
  message,
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator
        size={SIZE_MAP[size]}
        color={COLOR_MAP[variant]}
      />
      {message && <Text style={[styles.message, { color: COLOR_MAP[variant] }]}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  message: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.sm,
  },
});

export default Loader;
