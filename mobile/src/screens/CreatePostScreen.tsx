import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import Input from '../components/atoms/Input';
import TextArea from '../components/atoms/TextArea';
import Button from '../components/atoms/Button';
import CategoryPicker from '../components/molecules/CategoryPicker';
import DateTimePicker from '../components/molecules/DateTimePicker';
import LocationInput from '../components/molecules/LocationInput';
import ImagePicker from '../components/molecules/ImagePicker';
import UrgencySelector from '../components/molecules/UrgencySelector';
import { Category, UrgencyLevel, MainStackParamList } from '../types';
import { COLORS, SPACING, FONT_SIZE } from '../constants/config';

interface FormData {
  title: string;
  description: string;
  category: Category | undefined;
  location: string;
  preferredDate: Date | undefined;
  budget: string;
  images: string[];
  urgency: UrgencyLevel;
}

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  location?: string;
  preferredDate?: string;
  budget?: string;
  urgency?: string;
}

const CreatePostScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: undefined,
    location: '',
    preferredDate: undefined,
    budget: '',
    images: [],
    urgency: 'normal',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'El título es requerido';
    } else if (formData.title.length < 10) {
      newErrors.title = 'El título debe tener al menos 10 caracteres';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    } else if (formData.description.length < 20) {
      newErrors.description = 'La descripción debe tener al menos 20 caracteres';
    }

    if (!formData.category) {
      newErrors.category = 'Selecciona una categoría';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'La dirección es requerida';
    }

    if (!formData.preferredDate) {
      newErrors.preferredDate = 'Selecciona una fecha y hora';
    }

    if (formData.budget && isNaN(Number(formData.budget))) {
      newErrors.budget = 'El presupuesto debe ser un número';
    }

    if (!formData.urgency) {
      newErrors.urgency = 'Selecciona la urgencia';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePreview = () => {
    if (!validateForm()) {
      return;
    }

    // Navigate to preview screen with form data
    navigation.navigate('PostPreview', {
      title: formData.title,
      description: formData.description,
      category: formData.category!,
      location: formData.location,
      preferredDate: formData.preferredDate!,
      budget: formData.budget,
      images: formData.images,
      urgency: formData.urgency,
    } as any);
  };

  const isFormValid = () => {
    return (
      formData.title.trim().length >= 10 &&
      formData.description.trim().length >= 20 &&
      formData.category !== undefined &&
      formData.location.trim() &&
      formData.preferredDate !== undefined &&
      formData.urgency !== undefined
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Nueva Solicitud</Text>
            <Text style={styles.subtitle}>
              Los profesionales te enviarán propuestas para coordinar el trabajo. El pago se acuerda por fuera de la app.
            </Text>
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categoría</Text>
            <CategoryPicker
              label=""
              value={formData.category}
              onChange={(category) =>
                setFormData({ ...formData, category })
              }
              error={errors.category}
              placeholder="¿Qué tipo de problema o solicitud querés publicar?"
            />
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Título</Text>
            <Input
              value={formData.title}
              onChangeText={(text) =>
                setFormData({ ...formData, title: text })
              }
              placeholder="Ej: Necesito electricista para instalar ventiladores"
              error={errors.title}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <TextArea
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              placeholder="Describe detalladamente el trabajo que necesitás hacer..."
              error={errors.description}
              helperText={`${formData.description.length}/500 caracteres`}
              maxLength={500}
            />
            <Text style={styles.sectionHint}>
              Los profesionales te enviarán propuestas para coordinar el trabajo.
            </Text>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            <LocationInput
              value={formData.location}
              onChange={(address) =>
                setFormData({ ...formData, location: address })
              }
              error={errors.location}
              placeholder="Av. Corrientes 1234, Buenos Aires"
            />
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fecha y Hora Preferida</Text>
            <DateTimePicker
              value={formData.preferredDate}
              onChange={(date) =>
                setFormData({ ...formData, preferredDate: date })
              }
              error={errors.preferredDate}
              placeholder="¿Cuándo preferís coordinar la visita o el trabajo?"
              minimumDate={new Date()}
            />
          </View>

          {/* Budget */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Referencia de presupuesto (Opcional)</Text>
            <Input
              value={formData.budget}
              onChangeText={(text) =>
                setFormData({ ...formData, budget: text })
              }
              placeholder="Monto estimado en pesos"
              error={errors.budget}
              keyboardType="numeric"
              hint="Es una referencia para profesionales. El pago se acuerda por fuera de la app."
            />
          </View>

          {/* Images */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotos (Opcional)</Text>
            <ImagePicker
              images={formData.images}
              onImagesChange={(images) =>
                setFormData({ ...formData, images })
              }
              maxImages={3}
            />
          </View>

          {/* Urgency Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Urgencia</Text>
            <UrgencySelector
              value={formData.urgency}
              onChange={(urgency) => setFormData({ ...formData, urgency })}
              error={errors.urgency}
            />
          </View>

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Button
              title="Ver Vista Previa"
              onPress={handlePreview}
              disabled={!isFormValid()}
              fullWidth
              size="lg"
            />
            {!isFormValid() && (
              <Text style={styles.validationHint}>
                Completá los campos obligatorios para continuar
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
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
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  submitSection: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  validationHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});

export default CreatePostScreen;
