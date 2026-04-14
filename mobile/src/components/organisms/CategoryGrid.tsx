import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Category } from '../../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = SPACING.md;
const CARD_WIDTH = (SCREEN_WIDTH - (SPACING.lg * 2) - GRID_GAP) / 2;

interface CategoryGridProps {
  categories: Category[];
  onCategoryPress: (category: Category) => void;
  professionalCounts?: Record<string, number>;
}

const DEFAULT_ICONS: Record<string, string> = {
  electricidad: '⚡',
  plomeria: '🔧',
  gas: '🔥',
  carpinteria: '🪵',
  pintura: '🎨',
  jardineria: '🌿',
  limpieza: '🧹',
  'aire-acondicionado': '❄️',
  default: '🔨',
};

const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  onCategoryPress,
  professionalCounts = {},
}) => {
  const getCategoryIcon = (category: Category): string => {
    if (category.icon) return category.icon;
    return DEFAULT_ICONS[category.slug] || DEFAULT_ICONS.default;
  };

  const getProfessionalCount = (slug: string): number | undefined => {
    const count = professionalCounts[slug];
    return count !== undefined ? count : undefined;
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {categories.map((category) => {
          const count = getProfessionalCount(category.slug);
          return (
            <TouchableOpacity
              key={category.id}
              style={styles.card}
              onPress={() => onCategoryPress(category)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{getCategoryIcon(category)}</Text>
              </View>
              <Text style={styles.name}>{category.name}</Text>
              {count !== undefined && (
                <Text style={styles.count}>
                  {count} profesionales
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  icon: {
    fontSize: 32,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  count: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: FONT_WEIGHT.medium,
  },
});

export default CategoryGrid;
