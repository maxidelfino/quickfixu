import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle } from 'react-native';
import { Professional } from '../../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';
import Badge from '../atoms/Badge';
import DistanceBadge from '../atoms/DistanceBadge';

interface ProfessionalCardProps {
  professional: Professional;
  onPress?: () => void;
  variant?: 'default' | 'compact' | 'horizontal';
  style?: ViewStyle;
}

const ProfessionalCard: React.FC<ProfessionalCardProps> = ({
  professional,
  onPress,
  variant = 'default',
  style,
}) => {
  const { name, photoUrl, professional: profData, distance } = professional;
  const rating = profData?.rating || 0;
  const reviewCount = profData?.reviewCount || 0;
  const isVerified = profData?.isVerified || false;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        style={[styles.horizontalContainer, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.horizontalImageContainer}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.horizontalImage} />
          ) : (
            <View style={styles.horizontalPlaceholder}>
              <Text style={styles.horizontalInitials}>{getInitials(name)}</Text>
            </View>
          )}
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedIcon}>✓</Text>
            </View>
          )}
        </View>
        <View style={styles.horizontalContent}>
          <View style={styles.nameRow}>
            <Text style={styles.horizontalName}>{name}</Text>
          </View>
          {rating > 0 && (
            <View style={styles.ratingContainer}>
              <Text style={styles.starIcon}>⭐</Text>
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              <Text style={styles.reviewCountText}>({reviewCount})</Text>
            </View>
          )}
          <View style={styles.categoriesRow}>
            {profData?.categories?.slice(0, 2).map((cat) => (
              <View key={cat.id} style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{cat.name}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.arrowIcon}>›</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.compactImage} />
        ) : (
          <View style={styles.compactPlaceholder}>
            <Text style={styles.compactInitials}>{getInitials(name)}</Text>
          </View>
        )}
        <View style={styles.compactContent}>
          <Text style={styles.compactName} numberOfLines={1}>
            {name}
          </Text>
          {rating > 0 && (
            <View style={styles.compactRating}>
              <Text style={styles.starIcon}>⭐</Text>
              <Text style={styles.compactRatingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.initials}>{getInitials(name)}</Text>
          </View>
        )}
        {isVerified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedIcon}>✓</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {distance !== undefined && (
            <DistanceBadge distance={distance} />
          )}
        </View>
        {rating > 0 && (
          <View style={styles.ratingContainer}>
            <Text style={styles.starIcon}>⭐</Text>
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            <Text style={styles.reviewCountText}>({reviewCount})</Text>
          </View>
        )}
        {profData?.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {profData.bio}
          </Text>
        )}
        <View style={styles.categoriesContainer}>
          {profData?.categories?.slice(0, 3).map((cat) => (
            <View key={cat.id} style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{cat.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: BORDER_RADIUS.md,
  },
  placeholder: {
    width: '100%',
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray400,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedIcon: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: FONT_WEIGHT.bold,
  },
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    flex: 1,
    marginRight: SPACING.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  starIcon: {
    fontSize: 14,
    marginRight: 2,
  },
  ratingText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray800,
    marginRight: 4,
  },
  reviewCountText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
  },
  bio: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  categoryPill: {
    backgroundColor: COLORS.primaryLight + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryPillText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  // Compact variant
  compactContainer: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    width: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  compactImage: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
  },
  compactPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInitials: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray400,
  },
  compactContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  compactName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray900,
  },
  compactRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactRatingText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray600,
    marginLeft: 2,
  },
  // Horizontal variant
  horizontalContainer: {
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
    width: 280,
  },
  horizontalImageContainer: {
    position: 'relative',
  },
  horizontalImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
  },
  horizontalPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalInitials: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray400,
  },
  horizontalContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  horizontalName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    marginBottom: 2,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  arrowIcon: {
    fontSize: 24,
    color: COLORS.gray400,
    marginLeft: SPACING.sm,
  },
});

export default ProfessionalCard;
