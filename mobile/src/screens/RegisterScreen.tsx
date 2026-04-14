import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList, RegisterData, Category } from '../types';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services';
import { COLORS, SPACING } from '../constants/config';

import { Text, Button, TextArea } from '../components/atoms';
import Modal from '../components/atoms/Modal';
import { AuthForm } from '../components/organisms';
import { FormField, PasswordInput, RoleSelector, CategoryPicker, AuthButton, PasswordStrength } from '../components/molecules';
import { UserRole } from '../components/molecules/RoleSelector';
import { useOAuth } from '../hooks/useOAuth';

type RegisterNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;
type RegisterRouteProp = RouteProp<AuthStackParamList, 'Register'>;

// Validation helpers
const validateEmail = (email: string): string | undefined => {
  if (!email) return 'El email es requerido';
  if (email.includes(' ')) return 'El email no puede contener espacios';
  if (!email.includes('@')) return 'El email debe contener @';
  const parts = email.split('@');
  if (parts[0].length === 0) return 'Faltó el nombre de usuario antes del @';
  if (!parts[1] || !parts[1].includes('.')) return 'El email debe contener un punto después del @';
  if (parts[1].endsWith('.')) return 'El dominio del email no es válido';
  return undefined;
};

const validatePhone = (phone: string): string | undefined => {
  if (!phone) return 'El teléfono es requerido';
  if (!formatPhoneForBackend(phone)) return 'Ingresá un teléfono válido (ej: +54 9 11 1234-5678)';
  return undefined;
};

const validateDNI = (dni: string): string | undefined => {
  if (!dni) return 'El DNI es requerido';
  const dniRegex = /^\d{7,8}$/;
  if (!dniRegex.test(dni)) return 'El DNI debe tener 7 u 8 dígitos';
  return undefined;
};

const validateAddress = (address: string): string | undefined => {
  if (!address.trim()) return 'La dirección es requerida';
  if (address.trim().length < 10) return 'La dirección debe tener al menos 10 caracteres';
  return undefined;
};

const validatePassword = (password: string): string | undefined => {
  if (!password) return 'La contraseña es requerida';
  if (password.length < 8) return 'Mínimo 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'Al menos 1 mayúscula';
  if (!/[0-9]/.test(password)) return 'Al menos 1 número';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'La contraseña debe contener al menos 1 caracter especial (!@#$%)';
  return undefined;
};

const validateConfirmPassword = (password: string, confirmPassword: string): string | undefined => {
  if (!confirmPassword) return 'Confirma tu contraseña';
  if (password !== confirmPassword) return 'Las contraseñas no coinciden';
  return undefined;
};

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

// Maps backend field names to Spanish labels
const FIELD_LABELS: Record<string, string> = {
  fullName: 'Nombre',
  password: 'Contraseña',
  phone: 'Teléfono',
  dni: 'DNI',
  address: 'Dirección',
  description: 'Descripción',
};

// Maps backend error message fragments to Spanish
const translateFieldMessage = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower === 'required') return 'es obligatorio';
  if (lower.includes('must contain at least 1 special character')) return 'debe tener al menos 1 caracter especial';
  return message;
};

// Maps server/network error messages to Spanish
const translateError = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes('invalid credentials') || lower.includes('invalid email or password') || lower.includes('unauthorized')) {
    return 'Credenciales incorrectas. Revisá tu email y contraseña';
  }
  if (lower.includes('network request failed') || lower.includes('network error') || lower.includes('failed to fetch')) {
    return 'Error de conexión. Verificá tu internet';
  }
  if (lower.includes('user not found') || lower.includes('no user')) {
    return 'Usuario no encontrado';
  }
  if (lower.includes('email already') || lower.includes('already registered') || lower.includes('already in use') || lower.includes('duplicate')) {
    return 'Este email ya está registrado';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Demasiados intentos. Esperá unos minutos';
  }
  if (lower.includes('account disabled') || lower.includes('user disabled') || lower.includes('account suspended')) {
    return 'Tu cuenta está deshabilitada. Contactá soporte';
  }
  // Already in Spanish or unknown
  if (/[áéíóúñ¿¡]/i.test(message)) return message;
  return 'Algo salió mal. Intentá de nuevo';
};

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterNavigationProp>();
  const route = useRoute<RegisterRouteProp>();
  const { login, setLoading, isLoading } = useAuthStore();
  const {
    signInWithGoogle,
    isGoogleLoading,
    isGoogleConfigured,
    signInWithFacebook,
    isFacebookLoading,
    isFacebookConfigured,
  } = useOAuth();
  const hasOAuthOptions = isGoogleConfigured || isFacebookConfigured;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');

  // Set initial role from onboarding if provided
  useEffect(() => {
    if (route.params?.role) {
      setRole(route.params.role);
    }
  }, [route.params?.role]);
  
  // Professional specific
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [yearsExperience, setYearsExperience] = useState('');
  const [bio, setBio] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Modal states
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'El nombre es requerido';
    
    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;
    
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;
    
    const dniError = validateDNI(dni);
    if (dniError) newErrors.dni = dniError;

    const addressError = validateAddress(address);
    if (addressError) newErrors.address = addressError;
    
    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;
    
    const confirmError = validateConfirmPassword(password, confirmPassword);
    if (confirmError) newErrors.confirmPassword = confirmError;
    
    // Professional validation
    if (role === 'professional') {
      if (!selectedCategory) newErrors.category = 'Seleccioná una categoría';
      if (!yearsExperience) newErrors.yearsExperience = 'Los años de experiencia son requeridos';
      if (!bio.trim()) newErrors.bio = 'La descripción es requerida';
      if (bio.trim().length > 0 && bio.trim().length < 10) {
        newErrors.bio = 'La descripción debe tener al menos 10 caracteres';
      }
    }

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

      const registerData: RegisterData = {
        name,
        email,
        phone: formattedPhone,
        dni,
        address,
        password,
        role,
        categoryIds: selectedCategory ? [Number(selectedCategory.id)] : undefined,
        yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : undefined,
        bio: bio || undefined,
      };
      const response = await authService.register(registerData);
      const accessToken = response.tokens?.accessToken ?? response.token;
      login(response.user, accessToken);
    } catch (error: any) {
      // Handle structured field errors from backend (400 with details array)
      const details = error?.details ?? error?.response?.details;
      if (Array.isArray(details) && details.length > 0) {
        const fieldErrors: Record<string, string> = {};
        const unmappedMessages: string[] = [];

        details.forEach(({ field, message }: { field: string; message: string }) => {
          const label = FIELD_LABELS[field];
          const translated = translateFieldMessage(message);
          if (label) {
            // Map backend field to local form field key
            const localField = field === 'fullName'
              ? 'name'
              : field === 'description'
                ? 'bio'
                : field === 'categoryIds'
                  ? 'category'
                  : field;
            fieldErrors[localField] = `${label} ${translated}`;
          } else {
            unmappedMessages.push(translated !== message ? translated : message);
          }
        });

        if (Object.keys(fieldErrors).length > 0) {
          setErrors(prev => ({ ...prev, ...fieldErrors }));
        }
        if (unmappedMessages.length > 0) {
          setErrorMessage(unmappedMessages.join('\n'));
          setErrorModalVisible(true);
        }
      } else {
        setErrorMessage(translateError(error.message || ''));
        setErrorModalVisible(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleFacebookSignIn = async () => {
    await signInWithFacebook();
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="h2" style={styles.title}>
            Unite a QuickFixU
          </Text>
          <Text variant="bodySmall" color="muted" style={styles.subtitle}>
            Completá tus datos para crear una cuenta
          </Text>

          <AuthForm style={styles.form}>
            {/* Role Selection */}
            <RoleSelector
              value={role}
              onChange={handleRoleChange}
            />

            {/* Form Fields */}
            <FormField
              label="Nombre completo"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              placeholder="Juan Pérez"
              error={errors.name}
              required
              autoCapitalize="words"
            />

            <FormField
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              placeholder="tu@email.com"
              error={errors.email}
              required
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormField
              label="Teléfono"
              value={phone}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9\s+\-]/g, '');
                setPhone(cleaned);
                if (errors.phone) setErrors({ ...errors, phone: '' });
              }}
              placeholder="+54 11 1234 5678"
              keyboardType="numeric"
              error={errors.phone}
              hint="Número argentino"
            />

            <FormField
              label="DNI"
              value={dni}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                setDni(cleaned);
                if (errors.dni) setErrors({ ...errors, dni: '' });
              }}
              placeholder="12345678"
              keyboardType="numeric"
              error={errors.dni}
              hint="7 u 8 dígitos"
            />

            <FormField
              label="Dirección"
              value={address}
              onChangeText={setAddress}
              placeholder="Av. Rivadavia 1234"
              error={errors.address}
              required
            />

            {/* Professional specific fields */}
            {role === 'professional' && (
              <>
                <CategoryPicker
                  label="Categoría"
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  error={errors.category}
                  placeholder="Seleccioná tu categoría"
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

                <TextArea
                  label="Descripción / Bio"
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Contanos sobre vos y tus servicios..."
                  numberOfLines={4}
                  style={styles.bioInput}
                  error={errors.bio}
                />
              </>
            )}

            <PasswordInput
              label="Contraseña"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              error={errors.password}
              hint="Mínimo 8 caracteres, 1 mayúscula y 1 número"
              required
            />

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <PasswordStrength password={password} />
              </View>
            )}

            <PasswordInput
              label="Confirmar contraseña"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
              }}
              error={errors.confirmPassword}
              required
            />

            {hasOAuthOptions && (
              <>
                {/* OAuth Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text variant="caption" style={styles.dividerText}>o</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* OAuth Buttons */}
                <View style={styles.oauthContainer}>
                  <AuthButton
                    provider="google"
                    onPress={handleGoogleSignIn}
                    loading={isGoogleLoading}
                    disabled={!isGoogleConfigured}
                    fullWidth
                  />
                  <View style={styles.oauthSpacer} />
                  <AuthButton
                    provider="facebook"
                    onPress={handleFacebookSignIn}
                    loading={isFacebookLoading}
                    disabled={!isFacebookConfigured}
                    fullWidth
                  />
                </View>
              </>
            )}

            {/* Submit Button */}
            <Button
              title={isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.submitButton}
            />

            {/* Login Link */}
            <View style={styles.loginSection}>
              <Text variant="body" color="muted">
                ¿Ya tenés cuenta?{' '}
              </Text>
              <Text
                variant="body"
                color="primary"
                style={styles.loginLink}
                onPress={() => navigation.goBack()}
              >
                Iniciá sesión
              </Text>
            </View>
          </AuthForm>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        title="Error"
        type="error"
        showCancel={false}
        primaryButton={{
          label: 'Entendido',
          onPress: () => setErrorModalVisible(false),
        }}
      >
        <Text variant="body" color="muted" style={styles.modalText}>
          {errorMessage}
        </Text>
      </Modal>
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
  submitButton: {
    marginTop: SPACING.lg,
  },
  passwordStrengthContainer: {
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
  },
  bioInput: {
    marginBottom: SPACING.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
  },
  oauthContainer: {
    marginBottom: SPACING.md,
  },
  oauthSpacer: {
    height: SPACING.sm,
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  loginLink: {
    fontWeight: '600',
  },
  modalText: {
    textAlign: 'center',
  },
});

export default RegisterScreen;
