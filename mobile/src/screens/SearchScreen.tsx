import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { userService, SearchFilters, SearchProfessionalsResponse } from '../services/user';
import { Category, Professional } from '../types';
import { SearchBar, FilterChip, ProfessionalCard } from '../components/molecules';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';

const SORT_OPTIONS = [
  { key: 'nearest', label: 'Cerca', icon: '📍' },
  { key: 'best_rated', label: 'Mejor valorados', icon: '⭐' },
  { key: 'most_reviews', label: 'Más reseñas', icon: '💬' },
  { key: 'newest', label: 'Nuevos', icon: '✨' },
];

const DISTANCE_OPTIONS = [
  { key: 'any', label: 'Cualquier distancia', value: undefined },
  { key: '1', label: '1 km', value: 1 },
  { key: '3', label: '3 km', value: 3 },
  { key: '5', label: '5 km', value: 5 },
  { key: '10', label: '10 km', value: 10 },
];

const CATEGORY_ICONS: Record<string, string> = {
  'electricidad': '⚡',
  'plomeria': '🔧',
  'gas': '🔥',
  'carpinteria': '🪵',
  'pintura': '🎨',
  'jardineria': '🌿',
  'limpieza': '🧹',
  'aire-acondicionado': '❄️',
  'default': '🔨',
};

const SearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SearchFilters['sortBy']>('nearest');
  const [maxDistance, setMaxDistance] = useState<number | undefined>(undefined);
  
  // Results state
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const LIMIT = 10;

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Search when filters change
  useEffect(() => {
    searchProfessionals(true);
  }, [selectedCategory, sortBy, maxDistance]);

  const loadCategories = async () => {
    try {
      const data = await userService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Fallback categories
      const fallback: Category[] = [
        { id: '1', name: 'Electricidad', slug: 'electricidad' },
        { id: '2', name: 'Plomería', slug: 'plomeria' },
        { id: '3', name: 'Gas', slug: 'gas' },
        { id: '4', name: 'Carpintería', slug: 'carpinteria' },
        { id: '5', name: 'Pintura', slug: 'pintura' },
        { id: '6', name: 'Jardinería', slug: 'jardineria' },
        { id: '7', name: 'Limpieza', slug: 'limpieza' },
        { id: '8', name: 'Aire Acondicionado', slug: 'aire-acondicionado' },
      ];
      setCategories(fallback);
    }
  };

  const searchProfessionals = async (reset: boolean = false) => {
    if (loading) return;
    
    const currentOffset = reset ? 0 : offset;
    
    if (reset) {
      setLoading(true);
    } else {
      setLoading(true);
    }
    
    try {
      const filters: SearchFilters = {
        category: selectedCategory || undefined,
        query: searchQuery.trim() || undefined,
        sortBy,
        limit: LIMIT,
        offset: currentOffset,
      };

      const response: SearchProfessionalsResponse = await userService.searchProfessionals(filters);
      
      if (reset) {
        setProfessionals(response.professionals);
      } else {
        setProfessionals(prev => [...prev, ...response.professionals]);
      }
      
      setTotalResults(response.total);
      setHasMore(response.hasMore);
      setOffset(currentOffset + LIMIT);
    } catch (error) {
      console.error('Error searching professionals:', error);
      // Fallback mock data for demo
      if (reset) {
        setProfessionals(getMockProfessionals());
        setTotalResults(5);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  const getMockProfessionals = (): Professional[] => {
    const mockCats = selectedCategory 
      ? [categories.find(c => c.slug === selectedCategory) || categories[0]]
      : categories.slice(0, 2);
    
    const allProfessionals: Professional[] = [
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
          categories: mockCats,
          bio: 'Electricista matriculado con más de 10 años de experiencia',
          rating: 4.8,
          reviewCount: 127,
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
          categories: mockCats,
          bio: 'Especialista en instalaciones eléctricas domiciliarias',
          rating: 4.5,
          reviewCount: 89,
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
          categories: mockCats,
          bio: 'Técnico en plomería con experiencia',
          rating: 4.2,
          reviewCount: 45,
          yearsExperience: 3,
          isVerified: false,
          isAvailable: true,
        },
        distance: 5.7,
      },
      {
        id: '4',
        email: 'ana@example.com',
        name: 'Ana Martínez',
        role: 'professional',
        createdAt: '',
        updatedAt: '',
        professional: {
          id: 'p4',
          userId: '4',
          categories: mockCats,
          bio: 'Gasista matriculado, especializado en instalaciones de gas natural',
          rating: 4.9,
          reviewCount: 203,
          yearsExperience: 15,
          isVerified: true,
          isAvailable: true,
        },
        distance: 8.2,
      },
      {
        id: '5',
        email: 'pedro@example.com',
        name: 'Pedro Sánchez',
        role: 'professional',
        createdAt: '',
        updatedAt: '',
        professional: {
          id: 'p5',
          userId: '5',
          categories: mockCats,
          bio: 'Técnico de aire acondicionado y refrigeración',
          rating: 4.6,
          reviewCount: 78,
          yearsExperience: 8,
          isVerified: true,
          isAvailable: false,
        },
        distance: 12.5,
      },
    ];

    // Filter by max distance if set
    if (maxDistance) {
      return allProfessionals.filter(p => p.distance !== undefined && p.distance <= maxDistance);
    }

    return allProfessionals;
  };

  const handleSearch = useCallback(() => {
    searchProfessionals(true);
  }, [searchQuery, selectedCategory, sortBy]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    searchProfessionals(true);
  }, [selectedCategory, sortBy]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      searchProfessionals(false);
    }
  }, [loading, hasMore]);

  const handleCategoryPress = (slug: string) => {
    setSelectedCategory(prev => prev === slug ? null : slug);
  };

  const handleProfessionalPress = (professional: Professional) => {
    navigation.navigate('ProfessionalDetail', { professionalId: professional.id });
  };

  const handleContact = (professional: Professional) => {
    // Navigate to messages or start conversation
    console.log('Contact professional:', professional.name);
  };

  const renderCategoryChip = ({ item }: { item: Category }) => (
    <FilterChip
      label={item.name}
      icon={CATEGORY_ICONS[item.slug] || CATEGORY_ICONS.default}
      selected={selectedCategory === item.slug}
      onPress={() => handleCategoryPress(item.slug)}
    />
  );

  const renderSortChip = (option: typeof SORT_OPTIONS[0]) => (
    <FilterChip
      label={option.label}
      icon={option.icon}
      selected={sortBy === option.key}
      onPress={() => setSortBy(option.key as SearchFilters['sortBy'])}
    />
  );

  const renderProfessional = ({ item }: { item: Professional }) => (
    <ProfessionalCard
      professional={item}
      variant="horizontal"
      onPress={() => handleProfessionalPress(item)}
    />
  );

  const renderHeader = () => (
    <View style={styles.filtersContainer}>
      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categorías</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          <FilterChip
            label="Todas"
            icon="🏷️"
            selected={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
          />
          {categories.map((cat) => (
            <FilterChip
              key={cat.id}
              label={cat.name}
              icon={CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.default}
              selected={selectedCategory === cat.slug}
              onPress={() => handleCategoryPress(cat.slug)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Distance Filter */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Distancia</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {DISTANCE_OPTIONS.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              icon="📍"
              selected={maxDistance === option.value}
              onPress={() => setMaxDistance(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Sort Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ordenar por</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {SORT_OPTIONS.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              icon={option.icon}
              selected={sortBy === option.key}
              onPress={() => setSortBy(option.key as SearchFilters['sortBy'])}
            />
          ))}
        </ScrollView>
      </View>

      {/* Results count */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsCount}>
          {totalResults} profesional{totalResults !== 1 ? 'es' : ''} encontrado{totalResults !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (initialLoading) return null;
    
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>No se encontraron profesionales</Text>
        <Text style={styles.emptyDescription}>
          {searchQuery 
            ? `No hay resultados para "${searchQuery}"`
            : 'Probá seleccionando otra categoría o cambiando el orden'
          }
        </Text>
        {selectedCategory && (
          <TouchableOpacity 
            style={styles.clearFiltersButton}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Buscando profesionales...</Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading || initialLoading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="¿Qué profesional necesitás?"
          onSubmit={handleSearch}
          style={styles.searchBar}
        />
      </View>

      {/* Results */}
      <FlatList
        data={professionals}
        renderItem={renderProfessional}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={initialLoading ? renderLoading : renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: SPACING.md,
  },
  searchBar: {
    backgroundColor: COLORS.white,
  },
  filtersContainer: {
    paddingTop: SPACING.md,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  resultsInfo: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  resultsCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
  clearFiltersButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary + '15',
    borderRadius: BORDER_RADIUS.full,
  },
  clearFiltersText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
  },
  footer: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
});

export default SearchScreen;
