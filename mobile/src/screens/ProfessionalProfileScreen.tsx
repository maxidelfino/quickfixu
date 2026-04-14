import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { professionalsService } from '../services/professionals';
import { userService } from '../services/user';
import { UserBackend, Certification, MainStackParamList } from '../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';
import ProfessionalProfileHeader from '../components/organisms/ProfessionalProfileHeader';
import CertificationsSection from '../components/organisms/CertificationsSection';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const ProfessionalProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, token } = useAuthStore();

  const [profile, setProfile] = useState<UserBackend | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [certLoading, setCertLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await professionalsService.getMyProfile(token);
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch professional profile:', error);
      // Try fallback
      try {
        const fallback = await userService.getProfile(token);
        setProfile(fallback);
      } catch {
        // Use stored user data
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCertifications = useCallback(async () => {
    if (!token) {
      setCertLoading(false);
      return;
    }
    try {
      const data = await professionalsService.getMyCertifications(token);
      setCertifications(data);
    } catch (error) {
      console.error('Failed to fetch certifications:', error);
    } finally {
      setCertLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
    fetchCertifications();
  }, [fetchProfile, fetchCertifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchCertifications()]);
    setRefreshing(false);
  }, [fetchProfile, fetchCertifications]);

  const handleEditPhoto = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  const handleUploadCertification = useCallback(() => {
    navigation.navigate('CertificationUpload');
  }, [navigation]);

  const handleDeleteCertification = useCallback(
    (certId: number) => {
      Alert.alert(
        'Eliminar Certificación',
        '¿Estás seguro de que querés eliminar esta certificación?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              if (!token) return;
              try {
                await professionalsService.deleteCertification(certId, token);
                setCertifications((prev) =>
                  prev.filter((c) => c.id !== certId)
                );
              } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar la certificación');
              }
            },
          },
        ]
      );
    },
    [token]
  );

  const displayName = profile?.fullName || user?.name || 'Profesional';
  const displayEmail = profile?.email || user?.email || '';
  const displayPhone = profile?.phone || '';
  const displayPhoto = profile?.profilePhotoUrl || user?.photoUrl;
  const rating = profile?.rating;
  const reviewCount = profile?.ratingCount;
  const professionalData = profile?.professional;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Mi Perfil Profesional</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={handleEditProfile}
          activeOpacity={0.8}
        >
          <Text style={styles.editButtonText}>✏️ Editar</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Header Organism */}
      <ProfessionalProfileHeader
        name={displayName}
        email={displayEmail}
        phone={displayPhone}
        photoUrl={displayPhoto}
        rating={rating}
        reviewCount={reviewCount}
        categories={professionalData?.categories || []}
        yearsExperience={professionalData?.yearsExperience}
        isVerified={!!professionalData?.certifications?.some(c => c.status === 'approved')}
        onEditPhoto={handleEditPhoto}
        style={styles.profileHeader}
      />

      {/* Bio / Description */}
      {professionalData?.description ? (
        <View style={styles.bioSection}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.bioText}>{professionalData.description}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.bioEmptySection}
          onPress={handleEditProfile}
          activeOpacity={0.7}
        >
          <Text style={styles.bioEmptyIcon}>📝</Text>
          <Text style={styles.bioEmptyText}>Agregá una descripción de tus servicios</Text>
          <Text style={styles.bioEmptyLink}>Editar perfil →</Text>
        </TouchableOpacity>
      )}

      {/* Certifications Section Organism */}
      <CertificationsSection
        certifications={certifications}
        onUpload={handleUploadCertification}
        onDelete={handleDeleteCertification}
        loading={certLoading}
        style={styles.certSection}
      />

      {/* Professional Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {professionalData?.yearsExperience ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Años de{'\n'}experiencia</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {reviewCount ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Reseñas{'\n'}recibidas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {certifications.filter(c => c.status === 'approved').length}
            </Text>
            <Text style={styles.statLabel}>Certificaciones{'\n'}verificadas</Text>
          </View>
        </View>
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  contentContainer: {
    paddingBottom: SPACING.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl + SPACING.md,
    paddingBottom: SPACING.lg,
  },
  pageTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  editButton: {
    backgroundColor: COLORS.white + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.white + '40',
  },
  editButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.white,
  },
  profileHeader: {
    marginHorizontal: SPACING.lg,
    marginTop: -SPACING.md,
    marginBottom: SPACING.md,
  },
  bioSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    marginBottom: SPACING.sm,
  },
  bioText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
    lineHeight: 22,
  },
  bioEmptySection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  bioEmptyIcon: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  bioEmptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  bioEmptyLink: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
    marginTop: SPACING.xs,
  },
  certSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  statsSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.primary + '08',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '15',
  },
  statValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 16,
  },
  spacer: {
    height: SPACING.xl,
  },
});

export default ProfessionalProfileScreen;
