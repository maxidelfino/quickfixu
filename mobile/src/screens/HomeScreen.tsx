import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { userService } from '../services';
import { Category, Professional, MainStackParamList } from '../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';
import { StepCard, CategoryGrid } from '../components';
import ProfessionalCard from '../components/molecules/ProfessionalCard';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

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

// Professional counts are loaded from API — no mock data to avoid showing wrong numbers

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Electricista', slug: 'electricidad', icon: '⚡' },
  { id: '2', name: 'Plomero', slug: 'plomeria', icon: '🔧' },
  { id: '3', name: 'Gasista', slug: 'gas', icon: '🔥' },
];

const FEATURED_PROFESSIONALS: Professional[] = [
  {
    id: '1',
    email: 'juan@example.com',
    name: 'Juan Pérez',
    role: 'professional',
    createdAt: '',
    updatedAt: '',
    professional: {
      id: 'p1',
      userId: '1',
      categories: [{ id: '1', name: 'Electricista', slug: 'electricidad' }],
      bio: 'Electricista matriculado con más de 10 años de experiencia',
      rating: 4.8,
      reviewCount: 45,
      yearsExperience: 10,
      isVerified: true,
      isAvailable: true,
    },
    distance: 0.8,
  },
  {
    id: '2',
    email: 'maria@example.com',
    name: 'María González',
    role: 'professional',
    createdAt: '',
    updatedAt: '',
    professional: {
      id: 'p2',
      userId: '2',
      categories: [{ id: '2', name: 'Plomera', slug: 'plomeria' }],
      bio: 'Especialista en instalaciones domiciliarias',
      rating: 4.6,
      reviewCount: 28,
      yearsExperience: 7,
      isVerified: true,
      isAvailable: true,
    },
    distance: 2.3,
  },
  {
    id: '3',
    email: 'carlos@example.com',
    name: 'Carlos López',
    role: 'professional',
    createdAt: '',
    updatedAt: '',
    professional: {
      id: 'p3',
      userId: '3',
      categories: [{ id: '3', name: 'Gasista', slug: 'gas' }],
      bio: 'Gasista matriculado con experiencia en gas natural',
      rating: 4.9,
      reviewCount: 62,
      yearsExperience: 12,
      isVerified: true,
      isAvailable: true,
    },
    distance: 3.1,
  },
];

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCategories = async () => {
    try {
      const data = await userService.getCategories();
      if (data && data.length > 0) {
        setCategories(data);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryDetail', {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  const handleViewAllCategories = () => {
    navigation.navigate('CategoryList');
  };

  return (
    <View style={styles.container}>
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>QuickFixU</Text>
          <Text style={styles.heroSubtitle}>
            Encontrá el profesional ideal para tu hogar
          </Text>
        </View>
        <View style={styles.heroDecoration}>
          <Text style={styles.heroIcon}>🔧</Text>
        </View>
      </View>

      {/* Greeting Card */}
      <View style={styles.greetingCard}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Text style={styles.notificationIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <TouchableOpacity 
        style={styles.searchBar}
        onPress={() => navigation.navigate('SearchTab' as any)}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchText}>¿Qué servicio necesitás?</Text>
      </TouchableOpacity>

      {/* How It Works Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>¿Cómo Funciona?</Text>
        <View style={styles.stepsContainer}>
          <StepCard
            stepNumber={1}
            icon="🔍"
            title="Buscá"
            description="Encontrá el profesional que necesitás"
          />
          <StepCard
            stepNumber={2}
            icon="💬"
            title="Contactá"
            description="Chatea directamente con el profesional"
          />
          <StepCard
            stepNumber={3}
            icon="✅"
            title="Contratá"
            description="Acordá el servicio y horario"
          />
        </View>
      </View>

      {/* Categories Section - Grid de 2 columnas */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorías</Text>
          <TouchableOpacity onPress={handleViewAllCategories}>
            <Text style={styles.seeAll}>Ver todas</Text>
          </TouchableOpacity>
        </View>
        <CategoryGrid
          categories={categories}
          onCategoryPress={handleCategoryPress}

        />
      </View>

      {/* Featured Professionals Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profesionales Destacados</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredContainer}
        >
          {FEATURED_PROFESSIONALS.map((professional) => (
            <ProfessionalCard
              key={professional.id}
              professional={professional}
              variant="compact"
              onPress={() =>
                navigation.navigate('ProfessionalDetail', {
                  professionalId: professional.id,
                })
              }
            />
          ))}
        </ScrollView>
      </View>

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>

    {/* FAB - Create Post */}
    <TouchableOpacity
      style={styles.fab}
      onPress={() => navigation.navigate('CreatePost')}
      activeOpacity={0.8}
    >
      <Text style={styles.fabIcon}>+</Text>
    </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.background,
  },
  // Hero Section
  heroSection: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.white + 'CC',
    lineHeight: 22,
  },
  heroDecoration: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    fontSize: 40,
  },
  // Greeting Card
  greetingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginTop: -SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  greeting: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
  userName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  searchText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray400,
  },
  // Section
  section: {
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
  },
  seeAll: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  // Categories
  categoriesContainer: {
    gap: SPACING.md,
    paddingRight: SPACING.lg,
  },
  categoryCardWrapper: {
    width: 100,
  },
  // Featured Professionals
  featuredContainer: {
    gap: SPACING.md,
    paddingRight: SPACING.lg,
  },
  // Steps
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bottomSpacer: {
    height: SPACING.xxl,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: COLORS.white,
    fontWeight: '300',
    marginTop: -2,
  },
});

export default HomeScreen;
