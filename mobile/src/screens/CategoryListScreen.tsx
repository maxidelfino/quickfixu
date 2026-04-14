import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { userService } from '../services';
import { Category } from '../types';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../constants/config';
import { Grid, CategoryTile } from '../components';

type NavigationProp = NativeStackNavigationProp<any>;

// Professional counts are loaded from API — no mock data to avoid showing wrong numbers

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Electricidad', slug: 'electricidad', icon: '⚡' },
  { id: '2', name: 'Plomería', slug: 'plomeria', icon: '🔧' },
  { id: '3', name: 'Gas', slug: 'gas', icon: '🔥' },
  { id: '4', name: 'Carpintería', slug: 'carpinteria', icon: '🪵' },
  { id: '5', name: 'Pintura', slug: 'pintura', icon: '🎨' },
  { id: '6', name: 'Jardinería', slug: 'jardineria', icon: '🌿' },
  { id: '7', name: 'Limpieza', slug: 'limpieza', icon: '🧹' },
  { id: '8', name: 'Aire Acondicionado', slug: 'aire-acondicionado', icon: '❄️' },
];

const CategoryListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
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

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryDetail', {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

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
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Categorías</Text>
        <Text style={styles.subtitle}>
          Encontrá el profesional perfecto para tu hogar
        </Text>
      </View>

      <Grid columns={2} gap={SPACING.md}>
        {categories.map((category) => (
          <CategoryTile
            key={category.id}
            category={category}
            onPress={() => handleCategoryPress(category)}
          />
        ))}
      </Grid>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    lineHeight: 22,
  },
});

export default CategoryListScreen;
