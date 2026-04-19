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
import Icon, { type IconName } from '../components/atoms/Icon';
import StarRating from '../components/atoms/StarRating';
import { getCategoryIconName } from '../constants/iconography';

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
    { icon: 'notebook', title: 'Mis Solicitudes', subtitle: 'Seguir solicitudes, propuestas y cierres' },
    { icon: 'star', title: 'Reseñas', subtitle: 'Mis reseñas y calificaciones' },
    { icon: 'badge-check', title: 'Finalización', subtitle: 'Confirmar trabajos completados' },
    { icon: 'bell', title: 'Notificaciones', subtitle: 'Configurar alertas' },
    { icon: 'help', title: 'Ayuda y Soporte', subtitle: 'Preguntas frecuentes' },
    { icon: 'settings', title: 'Configuración', subtitle: 'Ajustes de la app' },
  ] satisfies Array<{ icon: IconName; title: string; subtitle: string }>;

  const professionalMenuItems = [
    { icon: 'layout-dashboard', title: 'Panel de Profesional', subtitle: 'Gestionar solicitudes y propuestas' },
    { icon: 'calendar', title: 'Agenda', subtitle: 'Ver coordinaciones y visitas' },
    { icon: 'badge-check', title: 'Confirmaciones pendientes', subtitle: 'Revisar cierres de trabajos' },
  ] satisfies Array<{ icon: IconName; title: string; subtitle: string }>;

  const roleIconName: IconName = isProfessional ? 'tool' : 'user';
  const roleLabel = isProfessional ? 'Profesional' : 'Cliente';

  const renderMenuItem = (item: { icon: IconName; title: string; subtitle: string }, key: string) => (
    <TouchableOpacity key={key} style={styles.menuItem}>
      <Icon name={item.icon} size="lg" color={COLORS.gray700} style={styles.menuIcon} />
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{item.title}</Text>
        <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
      </View>
      <Icon name="chevron-right" size="md" color={COLORS.gray400} />
    </TouchableOpacity>
  );

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
              <Icon name="phone" size="xs" color={COLORS.gray500} style={styles.infoIcon} />
              <Text style={styles.infoText}>{displayPhone}</Text>
            </View>
          ) : null}
          
          {/* Address */}
          {displayAddress ? (
            <View style={styles.infoRow}>
              <Icon name="location" size="xs" color={COLORS.gray500} style={styles.infoIcon} />
              <Text style={styles.infoText}>{displayAddress}</Text>
            </View>
          ) : null}
          
          {/* Role Badge */}
          <View style={styles.roleBadge}>
            <View style={styles.roleContent}>
              <Icon name={roleIconName} size="xs" color={COLORS.accent} style={styles.roleIcon} />
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
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
              <StarRating
                rating={Number(profile.rating)}
                maxStars={5}
                size="small"
                showValue={false}
              />
              <Text style={styles.ratingText}>
                {Number(profile.rating).toFixed(1)} ({profile.ratingCount} reseñas)
              </Text>
            </View>
          )}
          
          {/* Years of Experience */}
          {professionalData.yearsExperience > 0 && (
            <View style={styles.infoRow}>
              <Icon name="briefcase" size="xs" color={COLORS.gray500} style={styles.infoIcon} />
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
                    <View style={styles.categoryBadgeContent}>
                      <Icon
                        name={getCategoryIconName(cat.slug, cat.icon)}
                        size="xs"
                        color={COLORS.primary}
                        style={styles.categoryIcon}
                      />
                      <Text style={styles.categoryText}>{cat.name}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => renderMenuItem(item, `menu-${index}`))}
      </View>

      {/* Professional Menu (if applicable) */}
      {isProfessional && (
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Panel de Profesional</Text>
          {professionalMenuItems.map((item, index) => renderMenuItem(item, `pro-menu-${index}`))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <View style={styles.logoutButtonContent}>
          <Icon name="logout" size="sm" color={COLORS.error} style={styles.logoutIcon} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </View>
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
  roleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIcon: {
    marginRight: 6,
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
  categoryBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 6,
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
  logoutButton: {
    backgroundColor: COLORS.error + '10',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutIcon: {
    marginRight: SPACING.xs,
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
