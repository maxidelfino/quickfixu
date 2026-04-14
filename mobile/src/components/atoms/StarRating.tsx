import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: 'small' | 'medium' | 'large';
  showValue?: boolean;
  reviewCount?: number;
  style?: ViewStyle;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  size = 'medium',
  showValue = true,
  reviewCount,
  style,
}) => {
  const getStarSize = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'large':
        return 20;
      default:
        return 16;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return FONT_SIZE.xs;
      case 'large':
        return FONT_SIZE.lg;
      default:
        return FONT_SIZE.sm;
    }
  };

  const starSize = getStarSize();
  const fontSize = getFontSize();

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Text key={`full-${i}`} style={[styles.star, { fontSize: starSize }]}>
          ★
        </Text>
      );
    }

    // Half star
    if (hasHalfStar) {
      stars.push(
        <Text key="half" style={[styles.star, { fontSize: starSize }]}>
          ⭐
        </Text>
      );
    }

    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Text key={`empty-${i}`} style={[styles.star, styles.emptyStar, { fontSize: starSize }]}>
          ☆
        </Text>
      );
    }

    return stars;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.starsContainer}>{renderStars()}</View>
      {showValue && (
        <Text style={[styles.ratingValue, { fontSize }]}>
          {rating.toFixed(1)}
        </Text>
      )}
      {reviewCount !== undefined && (
        <Text style={[styles.reviewCount, { fontSize: fontSize - 2 }]}>
          ({reviewCount} {reviewCount === 1 ? 'reseña' : 'reseñas'})
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  star: {
    color: '#FFB800',
    marginRight: 2,
  },
  emptyStar: {
    color: COLORS.gray300,
  },
  ratingValue: {
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray800,
    marginRight: SPACING.xs,
  },
  reviewCount: {
    color: COLORS.gray500,
  },
});

export default StarRating;
