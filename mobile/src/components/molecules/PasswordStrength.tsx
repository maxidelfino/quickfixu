import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

interface PasswordStrengthProps {
  password: string;
}

type StrengthLevel = 'none' | 'weak' | 'medium' | 'strong';

const RULES = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: '1 letra mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 número', test: (p: string) => /[0-9]/.test(p) },
  { label: '1 caracter especial (!@#$%)', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const passedCount = RULES.filter(rule => rule.test(password)).length;

  const getStrength = (): StrengthLevel => {
    if (!password) return 'none';
    if (passedCount <= 1) return 'weak';
    if (passedCount <= 3) return 'medium';
    return 'strong';
  };

  const strength = getStrength();

  const getStrengthConfig = () => {
    switch (strength) {
      case 'none':
        return { level: 0, color: COLORS.gray300, label: '' };
      case 'weak':
        return { level: 1, color: COLORS.error, label: 'Débil' };
      case 'medium':
        return { level: 2, color: COLORS.warning, label: 'Media' };
      case 'strong':
        return { level: 3, color: COLORS.success, label: 'Fuerte' };
    }
  };

  const config = getStrengthConfig();

  return (
    <View style={styles.container}>
      <View style={styles.barsContainer}>
        {[1, 2, 3].map((level) => (
          <View
            key={level}
            style={[
              styles.bar,
              {
                backgroundColor:
                  level <= config.level ? config.color : COLORS.gray200,
              },
            ]}
          />
        ))}
      </View>
      {config.label && (
        <Text style={[styles.label, { color: config.color }]}>
          {config.label}
        </Text>
      )}
      <View style={styles.rulesContainer}>
        {RULES.map((rule) => {
          const passed = password ? rule.test(password) : false;
          return (
            <View key={rule.label} style={styles.ruleRow}>
              <Text style={[styles.ruleDot, { color: passed ? COLORS.success : COLORS.gray400 }]}>
                {passed ? '✓' : '·'}
              </Text>
              <Text style={[styles.ruleLabel, { color: passed ? COLORS.success : COLORS.gray400 }]}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.xs,
  },
  barsContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    marginTop: SPACING.xs,
  },
  rulesContainer: {
    marginTop: SPACING.xs,
    gap: 2,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  ruleDot: {
    fontSize: FONT_SIZE.sm,
    width: 14,
    textAlign: 'center',
  },
  ruleLabel: {
    fontSize: FONT_SIZE.xs,
  },
});

export default PasswordStrength;
