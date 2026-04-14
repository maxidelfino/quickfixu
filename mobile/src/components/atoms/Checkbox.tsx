import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  error,
  disabled = false,
  style,
}) => {
  const handlePress = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
          error && styles.checkboxError,
          disabled && styles.checkboxDisabled,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
      {label && (
        <TouchableOpacity onPress={handlePress} disabled={disabled} style={styles.labelContainer}>
          <Text style={[styles.label, disabled && styles.labelDisabled]}>
            {label}
          </Text>
        </TouchableOpacity>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.gray400,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxError: {
    borderColor: COLORS.error,
  },
  checkboxDisabled: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: FONT_WEIGHT.bold,
  },
  labelContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
    paddingTop: 1,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
    lineHeight: 20,
  },
  labelDisabled: {
    color: COLORS.gray400,
  },
  error: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
    marginLeft: SPACING.lg + SPACING.xs,
  },
});

export default Checkbox;
