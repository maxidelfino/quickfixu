import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';
import Icon, { type IconName } from '../atoms/Icon';

interface StepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  icon?: IconName;
  style?: ViewStyle;
}

const StepCard: React.FC<StepCardProps> = ({
  stepNumber,
  title,
  description,
  icon,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.numberContainer}>
        <Text style={styles.number}>{stepNumber}</Text>
      </View>
      {icon ? <Icon name={icon} size="xl" color={COLORS.primary} style={styles.icon} /> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
  },
  numberContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  number: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  icon: {
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default StepCard;
