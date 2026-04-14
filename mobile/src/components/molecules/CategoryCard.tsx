import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

interface CategoryCardProps {
  name: string;
  icon?: string;
  description?: string;
  professionalCount?: number;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  name,
  icon = '🔧',
  description,
  professionalCount,
  selected = false,
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        selected && styles.containerSelected,
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text
        style={[styles.name, selected && styles.nameSelected]}
        numberOfLines={2}
      >
        {name}
      </Text>
      {description && (
        <Text style={styles.description} numberOfLines={1}>
          {description}
        </Text>
      )}
      {professionalCount !== undefined && (
        <Text style={styles.count}>
          {professionalCount} profesionales
        </Text>
      )}
      {selected && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    minWidth: 100,
    maxWidth: 140,
  },
  containerSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  iconContainerSelected: {
    backgroundColor: COLORS.primary + '20',
  },
  icon: {
    fontSize: 24,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray800,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  nameSelected: {
    color: COLORS.primary,
  },
  description: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  count: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: FONT_WEIGHT.medium,
  },
  selectedBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
  },
});

export default CategoryCard;
