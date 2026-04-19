import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/config';
import { ICON_COMPONENTS, isIconName, type IconName } from '../../constants/iconography';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  name: IconName | string;
  size?: IconSize | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  provider?: 'lucide' | 'emoji' | 'text';
  strokeWidth?: number;
  fallback?: string;
}

const TEXT_ICON_MAP: Record<string, string> = {
  google: 'G',
  facebook: 'f',
  apple: 'A',
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
  provider = 'lucide',
  strokeWidth = 2.1,
  fallback,
}) => {
  const iconSize = typeof size === 'number' ? size : SIZE_MAP[size];

  if (provider !== 'lucide' || !isIconName(name)) {
    const content =
      provider === 'emoji'
        ? name
        : TEXT_ICON_MAP[name] || fallback || name.charAt(0).toUpperCase();

    return (
      <View style={[styles.container, { width: iconSize, height: iconSize }, style]}>
        <Text style={[styles.iconFallback, { fontSize: iconSize, color }]}>
          {content}
        </Text>
      </View>
    );
  }

  const LucideIcon = ICON_COMPONENTS[name];

  return (
    <View style={[styles.container, { width: iconSize, height: iconSize }, style]}>
      <LucideIcon color={color} size={iconSize} strokeWidth={strokeWidth} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallback: {
    textAlign: 'center',
  },
});

export default Icon;
export type { IconName };
