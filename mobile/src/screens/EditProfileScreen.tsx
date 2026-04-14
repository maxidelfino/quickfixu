import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../stores/authStore';
import { userService } from '../services/user';
import { UserBackend, Category, ProfileUpdateData } from '../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';
import { MainStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, token, setUser } = useAuthStore();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  
  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState<string>('');

  // Constants
  const MIN_DESCRIPTION_LENGTH = 10;
  const MAX_DESCRIPTION_LENGTH = 500;
  const MAX_CATEGORIES = 3;
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isProfessional, setIsProfessional] = useState(false);

  // Load profile and categories
  useEffect(() => {
    const loadData = async () => {
      if (!token) return;

      try {
        // Load profile
        const profile = await userService.getProfile(token);
        setFullName(profile.fullName || '');
        setPhone(profile.phone || '');
        setAddress(profile.address || '');
        setProfilePhotoUrl(profile.profilePhotoUrl || '');
        setIsProfessional(profile.role === 'professional');

        if (profile.professional) {
          setDescription(profile.professional.description || '');
          setYearsExperience(profile.professional.yearsExperience?.toString() || '');
          
          // Set selected categories
          const catIds = profile.professional.categories.map(c => c.id);
          setSelectedCategoryIds(catIds);
        }

        // Load available categories
        const cats = await userService.getCategories();
        setAvailableCategories(cats);
      } catch (error) {
        console.error('Failed to load profile:', error);
        Alert.alert('Error', 'No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para cambiar la foto');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] && token) {
      setUploadingPhoto(true);
      try {
        const response = await userService.uploadProfilePhoto(
          result.assets[0].uri,
          token
        );
        setProfilePhotoUrl(response.profilePhotoUrl);
        Alert.alert('Éxito', 'Foto de perfil actualizada');
      } catch (error) {
        console.error('Failed to upload photo:', error);
        Alert.alert('Error', 'No se pudo subir la foto');
      } finally {
        setUploadingPhoto(false);
      }
    }
  }, [token]);

  const handleSave = useCallback(async () => {
    if (!token) return;

    // Validation
    if (!fullName.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    // Professional fields validation
    if (isProfessional) {
      // Description length validation (10-500 chars)
      if (description.trim().length > 0 && description.trim().length < MIN_DESCRIPTION_LENGTH) {
        Alert.alert('Error', `La descripción debe tener al menos ${MIN_DESCRIPTION_LENGTH} caracteres`);
        return;
      }
      if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
        Alert.alert('Error', `La descripción no puede exceder ${MAX_DESCRIPTION_LENGTH} caracteres`);
        return;
      }

      // At least 1 category required
      if (selectedCategoryIds.length === 0) {
        setCategoryError('Seleccioná al menos una especialidad');
        return;
      }
    }

    setSaving(true);
    try {
      const updateData: ProfileUpdateData = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      };

      // Professional fields
      if (isProfessional) {
        if (yearsExperience) {
          const exp = parseInt(yearsExperience, 10);
          if (!isNaN(exp)) {
            updateData.yearsExperience = exp;
          }
        }
        if (description) {
          updateData.description = description.trim();
        }
        if (selectedCategoryIds.length > 0) {
          updateData.categoryIds = selectedCategoryIds;
        }
      }

      const updatedProfile = await userService.updateProfile(updateData, token);

      // Update local auth store
      if (user) {
        setUser({
          ...user,
          name: updatedProfile.fullName,
          photoUrl: updatedProfile.profilePhotoUrl,
        });
      }

      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  }, [token, fullName, phone, address, isProfessional, yearsExperience, description, selectedCategoryIds, user, setUser, navigation]);

  const toggleCategory = useCallback((categoryId: number) => {
    setCategoryError('');
    setSelectedCategoryIds(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      }
      // Enforce max 3 categories
      if (prev.length >= MAX_CATEGORIES) {
        return prev;
      }
      return [...prev, categoryId];
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Editar Perfil</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity 
            style={styles.photoContainer} 
            onPress={handlePickImage}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>📷</Text>
                <Text style={styles.photoPlaceholderLabel}>Agregar foto</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.photoHint}>Toca para cambiar la foto</Text>
        </View>

        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Personal</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Juan Pérez"
              placeholderTextColor={COLORS.gray400}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+54 9 11 1234 5678"
              placeholderTextColor={COLORS.gray400}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Av. Corrientes 1234, Buenos Aires"
              placeholderTextColor={COLORS.gray400}
            />
          </View>
        </View>

        {/* Professional Info */}
        {isProfessional && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Profesional</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Años de experiencia</Text>
              <TextInput
                style={styles.input}
                value={yearsExperience}
                onChangeText={setYearsExperience}
                placeholder="5"
                placeholderTextColor={COLORS.gray400}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Descripción / Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe tu experiencia y servicios..."
                placeholderTextColor={COLORS.gray400}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
              <Text style={[
                styles.charCounter,
                description.length > MAX_DESCRIPTION_LENGTH && styles.charCounterError,
                description.length > 0 && description.length < MIN_DESCRIPTION_LENGTH && styles.charCounterError
              ]}>
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </Text>
            </View>

            {/* Categories */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Especialidades ({selectedCategoryIds.length}/{MAX_CATEGORIES})
              </Text>
              <View style={styles.categoriesGrid}>
                {availableCategories.map((category) => {
                  const isSelected = selectedCategoryIds.includes(category.id);
                  const isDisabled = !isSelected && selectedCategoryIds.length >= MAX_CATEGORIES;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                        isDisabled && styles.categoryChipDisabled,
                      ]}
                      onPress={() => toggleCategory(category.id)}
                      disabled={isDisabled}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                          isDisabled && styles.categoryChipTextDisabled,
                        ]}
                      >
                        {category.icon} {category.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {categoryError ? (
                <Text style={styles.errorText}>{categoryError}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Cambios</Text>
          )}
        </TouchableOpacity>

        {/* Spacer */}
        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    fontSize: FONT_SIZE.md,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.medium,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  placeholder: {
    width: 60,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 32,
  },
  photoPlaceholderLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
  },
  photoHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    marginTop: SPACING.sm,
  },
  section: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    marginBottom: SPACING.md,
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray900,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 100,
    paddingTop: SPACING.md,
  },
  charCounter: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  charCounterError: {
    color: COLORS.error || '#ef4444',
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error || '#ef4444',
    marginTop: SPACING.xs,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.xs,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
  },
  categoryChipTextSelected: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.medium,
  },
  categoryChipDisabled: {
    opacity: 0.5,
  },
  categoryChipTextDisabled: {
    color: COLORS.gray400,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  spacer: {
    height: SPACING.xxl,
  },
});

export default EditProfileScreen;
