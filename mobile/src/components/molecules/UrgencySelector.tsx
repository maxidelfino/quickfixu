import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UrgencyLevel } from '../../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

interface UrgencySelectorProps {
  label?: string;
  value?: UrgencyLevel;
  onChange?: (urgency: UrgencyLevel) => void;
  error?: string;
}

const UrgencySelector: React.FC<UrgencySelectorProps> = ({
  label,
  value,
  onChange,
  error,
}) => {
  const handleSelect = (urgency: UrgencyLevel) => {
    onChange?.(urgency);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.option,
            value === 'normal' && styles.selectedOption,
            error && styles.optionError,
          ]}
          onPress={() => handleSelect('normal')}
          activeOpacity={0.7}
        >
          <Text style={styles.optionIcon}>🕐</Text>
          <View style={styles.optionContent}>
            <Text
              style={[
                styles.optionTitle,
                value === 'normal' && styles.selectedTitle,
              ]}
            >
              Normal
            </Text>
            <Text style={styles.optionDescription}>
              Puedo esperar unos días
            </Text>
          </View>
          {value === 'normal' && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.option,
            value === 'urgent' && styles.selectedOptionUrgent,
            error && styles.optionError,
          ]}
          onPress={() => handleSelect('urgent')}
          activeOpacity={0.7}
        >
          <Text style={styles.optionIcon}>🚨</Text>
          <View style={styles.optionContent}>
            <Text
              style={[
                styles.optionTitle,
                value === 'urgent' && styles.selectedTitleUrgent,
              ]}
            >
              Urgente
            </Text>
            <Text style={styles.optionDescriptionUrgent}>
              Necesito solución inmediata
            </Text>
          </View>
          {value === 'urgent' && (
            <Text style={styles.checkmarkUrgent}>✓</Text>
          )}
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsContainer: {
    gap: SPACING.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  selectedOption: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  selectedOptionUrgent: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '10',
  },
  optionError: {
    borderColor: COLORS.error,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
  },
  selectedTitle: {
    color: COLORS.primary,
  },
  selectedTitleUrgent: {
    color: COLORS.error,
  },
  optionDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    marginTop: 2,
  },
  optionDescriptionUrgent: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },
  checkmarkUrgent: {
    fontSize: 18,
    color: COLORS.error,
    fontWeight: FONT_WEIGHT.bold,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});

export default UrgencySelector;
