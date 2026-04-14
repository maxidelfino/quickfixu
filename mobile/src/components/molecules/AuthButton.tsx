import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';
import { Loader } from '../atoms';

export type AuthProvider = 'google' | 'facebook' | 'apple' | 'email';

interface AuthButtonProps {
  provider: AuthProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  customLabel?: string;
}

const PROVIDER_CONFIG: Record<AuthProvider, {
  label: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}> = {
  google: {
    label: 'Continuar con Google',
    icon: 'G',
    backgroundColor: COLORS.white,
    textColor: COLORS.gray800,
    borderColor: COLORS.border,
  },
  facebook: {
    label: 'Continuar con Facebook',
    icon: 'f',
    backgroundColor: '#1877F2',
    textColor: COLORS.white,
    borderColor: '#1877F2',
  },
  apple: {
    label: 'Continuar con Apple',
    icon: '',
    backgroundColor: COLORS.gray900,
    textColor: COLORS.white,
    borderColor: COLORS.gray900,
  },
  email: {
    label: 'Continuar con Email',
    icon: '✉',
    backgroundColor: COLORS.primary,
    textColor: COLORS.white,
    borderColor: COLORS.primary,
  },
};

const AuthButton: React.FC<AuthButtonProps> = ({
  provider,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  customLabel,
}) => {
  const config = PROVIDER_CONFIG[provider];
  const label = customLabel || config.label;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: config.backgroundColor, borderColor: config.borderColor },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <Loader size="sm" variant={provider === 'google' ? 'primary' : 'white'} />
      ) : (
        <View style={styles.content}>
          {provider !== 'email' && (
            <View style={[styles.iconContainer, { backgroundColor: provider === 'facebook' || provider === 'apple' ? 'transparent' : COLORS.gray100 }]}>
              <Text style={[styles.icon, { color: config.textColor }]}>{config.icon}</Text>
            </View>
          )}
          <Text style={[styles.label, { color: config.textColor }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderWidth: 1,
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },
});

export default AuthButton;
