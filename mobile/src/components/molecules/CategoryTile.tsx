import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Category } from '../../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';
import { getCategoryIconName } from '../../constants/iconography';
import Badge from '../atoms/Badge';
import Icon from '../atoms/Icon';

interface CategoryTileProps {
  category: Category;
  professionalCount?: number;
  onPress?: () => void;
  variant?: 'default' | 'featured';
  style?: ViewStyle;
}

const CategoryTile: React.FC<CategoryTileProps> = ({
  category,
  professionalCount,
  onPress,
  variant = 'default',
  style,
}) => {
  const getIconName = () => {
    return getCategoryIconName(category.slug, category.icon);
  };

  if (variant === 'featured') {
    return (
      <TouchableOpacity
        style={[styles.featuredContainer, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.featuredIconContainer}>
          <Icon name={getIconName()} size="lg" color={COLORS.primary} />
        </View>
        <View style={styles.featuredContent}>
          <Text style={styles.featuredName}>{category.name}</Text>
          {professionalCount !== undefined && (
            <Text style={styles.featuredCount}>
              {professionalCount} profesional{professionalCount !== 1 ? 'es' : ''}
            </Text>
          )}
        </View>
        {professionalCount !== undefined && (
          <Badge count={professionalCount} variant="accent" size="md" />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Icon name={getIconName()} size="xl" color={COLORS.primary} />
        {professionalCount !== undefined && professionalCount > 0 && (
          <View style={styles.badgeContainer}>
            <Badge count={professionalCount} variant="accent" />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: SPACING.sm,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -8,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray800,
    textAlign: 'center',
  },
  // Featured variant styles
  featuredContainer: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featuredContent: {
    flex: 1,
  },
  featuredName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    marginBottom: 2,
  },
  featuredCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
});

export default CategoryTile;
