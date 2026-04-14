import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList, Category } from '../types';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services';
import { COLORS, SPACING } from '../constants/config';

import { Text, Button, Input, Select, Loader } from '../components/atoms';
import { AuthForm, Header } from '../components/organisms';
import { CategoryCard, FormField, PasswordInput } from '../components/molecules';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'RegisterProfessional'>;

// Mock categories - in real app, fetch from API
const CATEGORIES: Category[] = [
  { id: '1', name: 'Carpintería', slug: 'carpinteria', icon: '🪵' },
  { id: '2', name: 'Electricidad', slug: 'electricidad', icon: '⚡' },
  { id: '3', name: 'Plomería', slug: 'plomeria', icon: '🚿' },
  { id: '4', name: 'Pintura', slug: 'pintura', icon: '🎨' },
  { id: '5', name: 'Limpieza', slug: 'limpieza', icon: '🧹' },
  { id: '6', name: 'Mudanzas', slug: 'mudanzas', icon: '📦' },
  { id: '7', name: 'Jardinería', slug: 'jardineria', icon: '🌿' },
  { id: '8', name: 'Aires', slug: 'aires', icon: '❄️' },
];

const formatPhoneForBackend = (phone: string): string | undefined => {
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!digits.startsWith('9')) {
    digits = `9${digits}`;
  }

  if (digits.length < 11 || digits.length > 13) {
    return undefined;
  }

  const areaCodeLength = digits.length - 9;
  const areaCode = digits.slice(1, 1 + areaCodeLength);
  const lineNumber = digits.slice(-8);

  return `+54 9 ${areaCode} ${lineNumber.slice(0, 4)}-${lineNumber.slice(4)}`;
};

const RegisterProfessionalScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { login, setLoading, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'El nombre es requerido';
    if (!email.trim()) newErrors.email = 'El email es requerido';
    if (!phone.trim()) newErrors.phone = 'El teléfono es requerido';
    if (!formatPhoneForBackend(phone)) newErrors.phone = 'Ingresá un teléfono válido (ej: +54 9 11 1234-5678)';
    if (!/^\d{7,8}$/.test(dni)) newErrors.dni = 'El DNI debe tener 7 u 8 dígitos';
    if (!address.trim()) newErrors.address = 'La dirección es requerida';
    if (address.trim().length < 10) newErrors.address = 'La dirección debe tener al menos 10 caracteres';
    if (!password) newErrors.password = 'La contraseña es requerida';
    if (password.length < 8) newErrors.password = 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(password)) newErrors.password = 'Al menos 1 mayúscula';
    if (!/[0-9]/.test(password)) newErrors.password = 'Al menos 1 número';
    if (!/[^a-zA-Z0-9]/.test(password)) newErrors.password = 'Al menos 1 caracter especial';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden';
    if (selectedCategories.length === 0) newErrors.categories = 'Selecciona al menos una categoría';
    if (!yearsExperience.trim()) newErrors.yearsExperience = 'Los años de experiencia son requeridos';
    if (!bio.trim()) newErrors.bio = 'La descripción es requerida';
    if (bio.trim().length > 0 && bio.trim().length < 10) newErrors.bio = 'La descripción debe tener al menos 10 caracteres';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const formattedPhone = formatPhoneForBackend(phone);

      if (!formattedPhone) {
        setErrors((prev) => ({ ...prev, phone: 'Ingresá un teléfono válido (ej: +54 9 11 1234-5678)' }));
        return;
      }

      const response = await authService.register({
        name,
        email,
        phone: formattedPhone,
        dni,
        address,
        password,
        role: 'professional',
        categoryIds: selectedCategories.map((categoryId) => Number(categoryId)),
        yearsExperience: parseInt(yearsExperience, 10),
        bio,
      });
      const accessToken = response.tokens?.accessToken ?? response.token;
      login(response.user, accessToken);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Registrar Profesional"
        showBack
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="h2" style={styles.title}>
            Completa tu perfil
          </Text>
          <Text variant="bodySmall" color="muted" style={styles.subtitle}>
            Seleccioná las categorías en las que trabajás
          </Text>

          <AuthForm style={styles.form}>
            {/* Categories Selection */}
            <View style={styles.section}>
              <Text variant="label" style={styles.sectionTitle}>
                Categorías *
              </Text>
              {errors.categories && (
                <Text variant="caption" color="error" style={styles.error}>
                  {errors.categories}
                </Text>
              )}
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((category) => (
                  <CategoryCard
                    key={category.id}
                    name={category.name}
                    icon={category.icon}
                    selected={selectedCategories.includes(category.id)}
                    onPress={() => toggleCategory(category.id)}
                    style={styles.categoryCard}
                  />
                ))}
              </View>
            </View>

            {/* Personal Info */}
            <FormField
              label="Nombre completo"
              value={name}
              onChangeText={setName}
              placeholder="Juan Pérez"
              error={errors.name}
              required
              autoCapitalize="words"
            />

            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              error={errors.email}
              required
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormField
              label="Teléfono"
              value={phone}
              onChangeText={setPhone}
              placeholder="+54 9 11 1234-5678"
              keyboardType="phone-pad"
              error={errors.phone}
              required
            />

            <FormField
              label="DNI"
              value={dni}
              onChangeText={setDni}
              placeholder="12345678"
              keyboardType="numeric"
              error={errors.dni}
              required
            />

            <FormField
              label="Dirección"
              value={address}
              onChangeText={setAddress}
              placeholder="Av. Rivadavia 1234"
              error={errors.address}
              required
            />

            <PasswordInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              hint="Mínimo 8 caracteres, 1 mayúscula y 1 número"
              required
            />

            <PasswordInput
              label="Confirmar contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              required
            />

            {/* Professional Info */}
            <FormField
              label="Biografía"
              value={bio}
              onChangeText={setBio}
              placeholder="Contá sobre tu experiencia..."
              multiline
              numberOfLines={3}
              error={errors.bio}
              required
            />

            <FormField
              label="Años de experiencia"
              value={yearsExperience}
              onChangeText={setYearsExperience}
              placeholder="5"
              keyboardType="numeric"
              error={errors.yearsExperience}
              required
            />

            <Button
              title={isLoading ? '' : 'Crear Cuenta'}
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.submitButton}
            />
          </AuthForm>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  title: {
    marginBottom: SPACING.xs,
  },
  subtitle: {
    marginBottom: SPACING.lg,
  },
  form: {
    marginTop: SPACING.md,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    marginBottom: SPACING.sm,
  },
  error: {
    marginBottom: SPACING.sm,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'flex-start',
  },
  categoryCard: {
    width: '47%',
  },
  submitButton: {
    marginTop: SPACING.lg,
  },
});

export default RegisterProfessionalScreen;
