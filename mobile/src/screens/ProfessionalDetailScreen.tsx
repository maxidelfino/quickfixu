import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { MainStackParamList, Review, ReviewsResponse } from '../types';
import { userService } from '../services/user';
import { professionalsService } from '../services/professionals';
import { Professional } from '../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';
import Button from '../components/atoms/Button';
import Badge from '../components/atoms/Badge';
import StarRating from '../components/atoms/StarRating';
import DistanceBadge from '../components/atoms/DistanceBadge';

type ProfessionalDetailRouteProp = RouteProp<MainStackParamList, 'ProfessionalDetail'>;

const ProfessionalDetailScreen: React.FC = () => {
  const route = useRoute<ProfessionalDetailRouteProp>();
  const navigation = useNavigation<any>();
  const { professionalId } = route.params;

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfessional();
    loadReviews();
  }, [professionalId]);

  const loadProfessional = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getProfessionalById(professionalId);
      setProfessional(data);
    } catch (err) {
      console.error('Error loading professional:', err);
      // Fallback mock data for demo
      setProfessional(getMockProfessional(professionalId));
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      // Parse string ID to number for the backend API
      const numericId = parseInt(professionalId, 10);
      if (isNaN(numericId)) {
        console.warn('Invalid professional ID for reviews fetch:', professionalId);
        setReviews([]);
        return;
      }
      const response: ReviewsResponse = await professionalsService.getProfessionalReviews(numericId);
      setReviews(response.reviews || []);
    } catch (err) {
      console.error('Error loading reviews:', err);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const getMockProfessional = (id: string): Professional => ({
    id,
    email: 'juan@example.com',
    name: 'Juan Pérez',
    phone: '+54 11 1234-5678',
    photoUrl: 'https://i.pravatar.cc/300?img=11',
    role: 'professional',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    professional: {
      id: 'p1',
      userId: id,
      categories: [
        { id: '1', name: 'Electricista', slug: 'electricidad' },
        { id: '2', name: 'Aire Acondicionado', slug: 'aire-acondicionado' },
      ],
      bio: 'Electricista matriculado con más de 10 años de experiencia en instalaciones eléctricas domiciliarias, comerciales e industriales. Especializado en mantenimiento preventivo y correctivo, tableros eléctricos, y sistemas de ahorro energético.',
      rating: 4.8,
      reviewCount: 127,
      yearsExperience: 10,
      isVerified: true,
      isAvailable: true,
      location: {
        latitude: -34.6037,
        longitude: -58.3816,
        address: 'Palermo, Buenos Aires',
      },
    },
    distance: 2.5,
  });

  const handleContact = () => {
    if (professional?.phone) {
      Linking.openURL(`tel:${professional.phone}`);
    } else {
      Alert.alert('Contacto', 'El profesional no ha compartido su número de teléfono.');
    }
  };

  const handleRequestQuote = () => {
    // TODO: Connect this action to request/proposal flow in a future iteration.
    Alert.alert('Pedir propuesta', 'Esta función abrirá la solicitud y la coordinación en una próxima iteración.');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  if (error || !professional) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error al cargar</Text>
        <Text style={styles.errorMessage}>
          No se pudo cargar el perfil del profesional.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProfessional}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { name, photoUrl, professional: profData, phone } = professional;
  const rating = profData?.rating || 0;
  const reviewCount = profData?.reviewCount || 0;
  const yearsExperience = profData?.yearsExperience || 0;
  const bio = profData?.bio || '';
  const isVerified = profData?.isVerified || false;
  const isAvailable = profData?.isAvailable || false;
  const categories = profData?.categories || [];
  const distance = professional.distance;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Photo */}
        <View style={styles.header}>
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoInitials}>{getInitials(name)}</Text>
              </View>
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={styles.name}>{name}</Text>

          {/* Rating */}
          <View style={styles.ratingContainer}>
            <StarRating
              rating={rating}
              size="large"
              reviewCount={reviewCount}
            />
          </View>

          {/* Distance */}
          {distance !== undefined && (
            <DistanceBadge distance={distance} style={styles.distanceBadge} />
          )}

          {/* Availability */}
          <View style={styles.availabilityContainer}>
            <View
              style={[
                styles.availabilityDot,
                { backgroundColor: isAvailable ? COLORS.success : COLORS.gray400 },
              ]}
            />
            <Text style={styles.availabilityText}>
              {isAvailable ? 'Disponible' : 'No disponible'}
            </Text>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Especialidades</Text>
          <View style={styles.categoriesContainer}>
            {categories.map((cat) => (
              <Badge 
                key={cat.id} 
                label={cat.name}
                variant="primary" 
                style={styles.categoryBadge} 
              />
            ))}
          </View>
        </View>

        {/* Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experiencia</Text>
          <View style={styles.experienceContainer}>
            <Text style={styles.experienceIcon}>⏱️</Text>
            <Text style={styles.experienceText}>
              {yearsExperience} {yearsExperience === 1 ? 'año' : 'años'} de experiencia
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre mí</Text>
          <Text style={styles.description}>{bio}</Text>
        </View>

        {/* Location */}
        {profData?.location?.address && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            <View style={styles.locationContainer}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>{profData.location.address}</Text>
            </View>
            {/* TODO: Add MapView component when maps are configured */}
          </View>
        )}

        {/* Contact Info */}
        {phone && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contacto</Text>
            <View style={styles.contactContainer}>
              <Text style={styles.contactIcon}>📱</Text>
              <Text style={styles.contactText}>{phone}</Text>
            </View>
          </View>
        )}

        {/* Reviews Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reseñas de clientes</Text>
          {reviewsLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : reviews.length === 0 ? (
            <Text style={styles.noReviewsText}>Este profesional aún no tiene reseñas.</Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerInitials}>
                        {review.reviewerFullName?.charAt(0)?.toUpperCase() || 'A'}
                      </Text>
                    </View>
                    <View style={styles.reviewerInfo}>
                      <Text style={styles.reviewerName}>{review.reviewerFullName}</Text>
                      <StarRating
                        rating={review.rating}
                        size="small"
                        showValue={false}
                      />
                    </View>
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                </View>
              ))}
              {reviews.length > 5 && (
                <Text style={styles.moreReviewsText}>
                  + {reviews.length - 5} reseñas más
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          title="Contactar"
          variant="primary"
          onPress={handleContact}
          style={styles.contactButton}
          icon="📱"
        />
        <Button
          title="Pedir propuesta"
          variant="secondary"
          onPress={handleRequestQuote}
          style={styles.quoteButton}
          icon="📋"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray800,
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  photoInitials: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray400,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  verifiedIcon: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: FONT_WEIGHT.bold,
  },
  name: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  ratingContainer: {
    marginBottom: SPACING.sm,
  },
  distanceBadge: {
    marginBottom: SPACING.sm,
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  availabilityText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
  },
  section: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray800,
    marginBottom: SPACING.md,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryBadge: {
    backgroundColor: COLORS.primaryLight + '15',
  },
  experienceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  experienceIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  experienceText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
  },
  description: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    lineHeight: 24,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  locationText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  contactText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
  },
  noReviewsText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    fontStyle: 'italic',
  },
  reviewsList: {
    gap: SPACING.md,
  },
  reviewItem: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  reviewerInitials: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray800,
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray400,
  },
  reviewComment: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
    lineHeight: 20,
    marginLeft: 40, // Align with reviewer name (avatar width + margin)
  },
  moreReviewsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  contactButton: {
    flex: 1,
  },
  quoteButton: {
    flex: 1,
  },
});

export default ProfessionalDetailScreen;
