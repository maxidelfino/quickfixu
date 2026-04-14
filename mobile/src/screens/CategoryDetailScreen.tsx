import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/config';
import { ProfessionalCard, CategoryTile } from '../components';
import { Professional, Category } from '../types';

type RouteProps = RouteProp<MainStackParamList, 'CategoryDetail'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Mock data for demonstration
const MOCK_PROFESSIONALS: Professional[] = [
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
      categories: [{ id: '1', name: 'Electricidad', slug: 'electricidad' }],
      bio: 'Electricista con más de 10 años de experiencia en instalaciones residenciales y comerciales.',
      rating: 4.8,
      reviewCount: 45,
      yearsExperience: 10,
      isVerified: true,
      isAvailable: true,
    },
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
      categories: [{ id: '1', name: 'Electricidad', slug: 'electricidad' }],
      bio: 'Técnica electricista especializada en hogares y negocios.',
      rating: 4.6,
      reviewCount: 28,
      yearsExperience: 6,
      isVerified: true,
      isAvailable: true,
    },
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
      categories: [{ id: '1', name: 'Electricidad', slug: 'electricidad' }],
      bio: 'Electricista de mantenimiento. Servicios rápidos y eficientes.',
      rating: 4.5,
      reviewCount: 15,
      yearsExperience: 4,
      isVerified: false,
      isAvailable: false,
    },
  },
];

const CategoryDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { categoryId, categoryName } = route.params;

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Simulate API call - in production, fetch from API
    setTimeout(() => {
      setProfessionals(MOCK_PROFESSIONALS);
    }, 500);
  }, [categoryId]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  const handleProfessionalPress = (professionalId: string) => {
    navigation.navigate('ProfessionalDetail', { professionalId });
  };

  const renderProfessional = ({ item }: { item: Professional }) => (
    <View style={styles.cardContainer}>
      <ProfessionalCard
        professional={item}
        onPress={() => handleProfessionalPress(item.id)}
      />
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.resultCount}>
        {professionals.length} profesional{professionals.length !== 1 ? 'es' : ''} encontrado{professionals.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No hay profesionales disponibles</Text>
      <Text style={styles.emptySubtitle}>
        Pronto tendremos profesionales en esta categoría
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={professionals}
        renderItem={renderProfessional}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  resultCount: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray600,
  },
  cardContainer: {
    marginBottom: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray800,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    textAlign: 'center',
  },
});

export default CategoryDetailScreen;
