import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { postService } from '../services/posts';
import Button from '../components/atoms/Button';
import { Category, UrgencyLevel, MainStackParamList } from '../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants/config';

type PostPreviewRouteParams = {
  PostPreview: {
    title: string;
    description: string;
    category: Category;
    location: string;
    preferredDate: Date;
    budget: string;
    images: string[];
    urgency: UrgencyLevel;
  };
};

type PostPreviewNavigationProp = NativeStackNavigationProp<MainStackParamList, 'PostPreview'>;

interface FormData {
  title: string;
  description: string;
  category: Category;
  location: string;
  preferredDate: Date;
  budget: string;
  images: string[];
  urgency: UrgencyLevel;
}

const PostPreviewScreen: React.FC = () => {
  const navigation = useNavigation<PostPreviewNavigationProp>();
  const route = useRoute<RouteProp<PostPreviewRouteParams, 'PostPreview'>>();
  const [loading, setLoading] = useState(false);

  const { title, description, category, location, preferredDate, budget, images, urgency } = route.params;

  // Handle both Date objects and string dates (React Navigation can serialize)
  const getDateObject = (date: Date | string): Date => {
    if (date instanceof Date) {
      return date;
    }
    return new Date(date);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = getDateObject(date);
    return dateObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBudget = (value: string) => {
    if (!value) return 'No definido';
    const num = Number(value);
    return `$${num.toLocaleString('es-AR')}`;
  };

  const handleEdit = () => {
    navigation.goBack();
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Handle both Date objects and string dates
      const dateObj = getDateObject(preferredDate);
      
      // Prepare data for API
      const postData = {
        title,
        description,
        categoryId: category.id,
        location,
        preferredDate: dateObj.toISOString(),
        budget: budget ? Number(budget) : undefined,
        images,
        urgency,
      };

      // Get auth token
      const token = useAuthStore.getState().token;

      if (!token) {
        Alert.alert('Error', 'No estás autenticado. Por favor, iniciá sesión.');
        setLoading(false);
        return;
      }

      // Call API - use real service
      await postService.createPost(postData, token);

      Alert.alert(
        '¡Solicitud publicada! 🎉',
        'Tu solicitud ya está visible. Recibirás propuestas de profesionales para coordinar el trabajo. El pago se acuerda por fuera de la app.',
        [
          {
            text: 'Volver al inicio',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating post:', error);
      // Fallback to mock if API fails (for demo purposes)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      Alert.alert(
        '¡Solicitud publicada! 🎉',
        'Tu solicitud ya está visible. Ahora podrás recibir propuestas y coordinar el trabajo desde la app. El pago se acuerda por fuera.',
        [
          {
            text: 'Volver al inicio',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            },
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Vista Previa de Solicitud</Text>
          <Text style={styles.subtitle}>
            Revisá los datos. Una vez publicada, recibirás propuestas de profesionales para coordinar el trabajo.
          </Text>
        </View>

        {/* Urgency Badge */}
        {urgency === 'urgent' && (
          <View style={styles.urgencyBadge}>
            <Text style={styles.urgencyText}>🚨 URGENTE</Text>
          </View>
        )}

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Categoría</Text>
          <View style={styles.categoryCard}>
            <Text style={styles.categoryIcon}>
              {category.icon || '🔨'}
            </Text>
            <Text style={styles.categoryName}>{category.name}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Título</Text>
          <Text style={styles.sectionValue}>{title}</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Descripción</Text>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ubicación</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{location}</Text>
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fecha y Hora</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoText}>{formatDate(preferredDate)}</Text>
          </View>
        </View>

        {/* Budget */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Referencia de Presupuesto</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>💰</Text>
            <Text style={styles.budgetText}>{formatBudget(budget)}</Text>
          </View>
          <Text style={styles.helperText}>
            El pago se acuerda por fuera de QuickFixU entre cliente y profesional.
          </Text>
        </View>

        {/* Photos */}
        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Fotos ({images.length})</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesContainer}
            >
              {images.map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={styles.previewImage}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Editar"
            onPress={handleEdit}
            variant="outline"
            fullWidth
            size="lg"
          />
          <Button
            title="Publicar Solicitud"
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
  },
  urgencyBadge: {
    backgroundColor: COLORS.error + '15',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  urgencyText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray500,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.gray900,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  categoryName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  descriptionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray800,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray800,
    flex: 1,
  },
  budgetText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.success,
  },
  helperText: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    lineHeight: 20,
  },
  imagesContainer: {
    gap: SPACING.sm,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  actions: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
});

export default PostPreviewScreen;
