import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';
import { Category } from '../../types';
import { Star } from 'lucide-react-native';

interface ProfessionalProfileHeaderProps {
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  rating?: number;
  reviewCount?: number;
  categories?: Category[];
  yearsExperience?: number;
  isVerified?: boolean;
  onEditPhoto?: () => void;
  style?: ViewStyle;
}

const ProfessionalProfileHeader: React.FC<ProfessionalProfileHeaderProps> = ({
  name,
  email,
  phone,
  photoUrl,
  rating,
  reviewCount,
  categories = [],
  yearsExperience,
  isVerified = false,
  onEditPhoto,
  style,
}) => {
  const getInitials = (fullName: string): string => {
    const names = fullName.trim().split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const renderStars = (ratingValue: number): React.ReactNode[] => {
    const full = Math.round(ratingValue);
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < Math.min(full, 5); i++) {
      stars.push(
        <Star key={i} size={14} fill="#FFB800" color="#FFB800" strokeWidth={0} />
      );
    }
    return stars;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Photo + Edit button */}
      <View style={styles.photoSection}>
        <View style={styles.photoWrapper}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.initials}>{getInitials(name)}</Text>
            </View>
          )}
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedIcon}>✓</Text>
            </View>
          )}
        </View>

        {onEditPhoto && (
          <TouchableOpacity style={styles.editPhotoButton} onPress={onEditPhoto}>
            <Text style={styles.editPhotoIcon}>📷</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Name + Info */}
      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {isVerified && (
            <View style={styles.verifiedLabel}>
              <Text style={styles.verifiedLabelText}>Verificado</Text>
            </View>
          )}
        </View>

        <Text style={styles.email}>{email}</Text>

        {phone ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📱</Text>
            <Text style={styles.infoText}>{phone}</Text>
          </View>
        ) : null}

        {yearsExperience !== undefined && yearsExperience > 0 ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>💼</Text>
            <Text style={styles.infoText}>{yearsExperience} años de experiencia</Text>
          </View>
        ) : null}

        {/* Rating */}
        {rating !== undefined && rating > 0 ? (
          <View style={styles.ratingRow}>
            <View style={styles.ratingStarsContainer}>{renderStars(rating)}</View>
            <Text style={styles.ratingValue}>{Number(rating).toFixed(1)}</Text>
            {reviewCount !== undefined && reviewCount > 0 ? (
              <Text style={styles.reviewCount}>({reviewCount} reseñas)</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.noRating}>Sin calificaciones aún</Text>
        )}
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <View style={styles.categoriesSection}>
          <Text style={styles.categoriesLabel}>Especialidades</Text>
          <View style={styles.categoriesList}>
            {categories.map((cat) => (
              <View key={cat.id} style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.primary + '30',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary + '30',
  },
  initials: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  verifiedIcon: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: FONT_WEIGHT.bold,
  },
  editPhotoButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  editPhotoIcon: {
    fontSize: 14,
  },
  infoSection: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  name: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
  },
  verifiedLabel: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  verifiedLabelText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.semibold,
  },
  email: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  infoIcon: {
    fontSize: FONT_SIZE.sm,
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  ratingStarsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
  },
  reviewCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
  noRating: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray400,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  categoriesSection: {
    marginTop: SPACING.md,
    width: '100%',
  },
  categoriesLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  categoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  categoryText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
});

export default ProfessionalProfileHeader;
