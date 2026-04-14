import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { userService } from '../services/user';
import { UserBackend } from '../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';
import { MainStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, token, logout } = useAuthStore();
  
  const [profile, setProfile] = useState<UserBackend | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await userService.getProfile(token);
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      const message = err instanceof Error ? err.message : 'No se pudo cargar el perfil';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: logout },
      ]
    );
  }, [logout]);

  const handleEditPress = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  // Get display data from profile or fallback to stored user
  const displayName = profile?.fullName || user?.name || 'Usuario';
  const displayEmail = profile?.email || user?.email || 'email@example.com';
  const displayPhone = profile?.phone || '';
  const displayAddress = profile?.address || '';
  const displayPhoto = profile?.profilePhotoUrl || user?.photoUrl;
  const isProfessional = profile?.role === 'professional' || user?.role === 'professional';

  // Professional data
  const professionalData = profile?.professional;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const menuItems = [
    { icon: '📋', title: 'Mis Solicitudes', subtitle: 'Ver historial de servicios' },
    { icon: '⭐', title: 'Reseñas', subtitle: 'Mis reseñas y calificaciones' },
    { icon: '💳', title: 'Métodos de Pago', subtitle: 'Gestionar pagos' },
    { icon: '🔔', title: 'Notificaciones', subtitle: 'Configurar alertas' },
    { icon: '❓', title: 'Ayuda y Soporte', subtitle: 'Preguntas frecuentes' },
    { icon: '⚙️', title: 'Configuración', subtitle: 'Ajustes de la app' },
  ];

  const professionalMenuItems = [
    { icon: '📊', title: 'Panel de Profesional', subtitle: 'Gestionar mis servicios' },
    { icon: '📅', title: 'Agenda', subtitle: 'Ver mis turnos' },
    { icon: '💰', title: 'Ingresos', subtitle: 'Historial de ganancias' },
  ];

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mi Perfil</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{displayEmail}</Text>
          
          {/* Phone */}
          {displayPhone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📱</Text>
              <Text style={styles.infoText}>{displayPhone}</Text>
            </View>
          ) : null}
          
          {/* Address */}
          {displayAddress ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>{displayAddress}</Text>
            </View>
          ) : null}
          
          {/* Role Badge */}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {isProfessional ? '🔧 Profesional' : '👤 Cliente'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.editButton} onPress={handleEditPress}>
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>
      </View>

      {/* Professional Info Card */}
      {isProfessional && professionalData && (
        <View style={styles.professionalCard}>
          <Text style={styles.sectionTitle}>Información Profesional</Text>
          
          {/* Rating */}
          {profile?.rating > 0 && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingStars}>
                {'⭐'.repeat(Math.round(Number(profile.rating)))}
              </Text>
              <Text style={styles.ratingText}>
                {Number(profile.rating).toFixed(1)} ({profile.ratingCount} reseñas)
              </Text>
            </View>
          )}
          
          {/* Years of Experience */}
          {professionalData.yearsExperience > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>💼</Text>
              <Text style={styles.infoText}>
                {professionalData.yearsExperience} años de experiencia
              </Text>
            </View>
          )}
          
          {/* Description */}
          {professionalData.description ? (
            <Text style={styles.description}>{professionalData.description}</Text>
          ) : null}
          
          {/* Categories */}
          {professionalData.categories.length > 0 && (
            <View style={styles.categoriesContainer}>
              <Text style={styles.categoriesLabel}>Especialidades:</Text>
              <View style={styles.categoriesList}>
                {professionalData.categories.map((cat) => (
                  <View key={cat.id} style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>
                      {cat.icon} {cat.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Professional Menu (if applicable) */}
      {isProfessional && (
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Panel de Profesional</Text>
          {professionalMenuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>QuickFixU v1.0.0</Text>
      </View>
    </ScrollView>
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
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    margin: SPACING.lg,
    marginTop: -SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    marginRight: SPACING.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.full,
  },
  avatarText: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
  },
  profileEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  infoIcon: {
    fontSize: 12,
    marginRight: SPACING.xs,
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
  },
  roleBadge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },
  roleText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.accent,
  },
  editButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  editButtonText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
    fontSize: FONT_SIZE.sm,
  },
  professionalCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  ratingStars: {
    fontSize: FONT_SIZE.md,
    marginRight: SPACING.xs,
  },
  ratingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  categoriesContainer: {
    marginTop: SPACING.md,
  },
  categoriesLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray500,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  categoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  categoryText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
  },
  menuSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray500,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray900,
  },
  menuSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 24,
    color: COLORS.gray400,
  },
  logoutButton: {
    backgroundColor: COLORS.error + '10',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  appInfo: {
    alignItems: 'center',
    paddingBottom: SPACING.xxl,
  },
  appVersion: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray400,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.error,
    textAlign: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
});

export default ProfileScreen;
