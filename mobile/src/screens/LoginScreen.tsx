import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services';
import { useOAuth } from '../hooks/useOAuth';
import { COLORS, SPACING } from '../constants/config';

import { Text } from '../components/atoms';
import Modal from '../components/atoms/Modal';
import { AuthForm } from '../components/organisms';
import { FormField, PasswordInput, AuthButton } from '../components/molecules';

type LoginNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

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

const validatePassword = (password: string): string | undefined => {
  if (!password) return 'La contraseña es requerida';
  if (password.length < 6) return 'Mínimo 6 caracteres';
  return undefined;
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
  if (lower.includes('email already') || lower.includes('already registered') || lower.includes('duplicate')) {
    return 'Este email ya está registrado';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Demasiados intentos. Esperá unos minutos';
  }
  if (lower.includes('account disabled') || lower.includes('user disabled') || lower.includes('account suspended')) {
    return 'Tu cuenta está deshabilitada. Contactá soporte';
  }
  // Already in Spanish or unknown — return as-is if it looks Spanish, else generic
  if (/[áéíóúñ¿¡]/i.test(message)) return message;
  return 'Algo salió mal. Intentá de nuevo';
};

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNavigationProp>();
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Modal states
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;
    
    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await authService.login({ email, password });
      const accessToken = response.tokens?.accessToken ?? response.token;
      login(response.user, accessToken);
    } catch (error: any) {
      setErrorMessage(translateError(error.message || ''));
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
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
        >
          {/* Header Section */}
          <View style={styles.header}>
            <Text variant="h1" style={styles.logo}>
              🔧 QuickFixU
            </Text>
            <Text variant="body" color="muted" style={styles.subtitle}>
              Tu marketplace de servicios profesionales
            </Text>
          </View>

          {/* Auth Form */}
          <AuthForm style={styles.form}>
            <Text variant="h3" style={styles.formTitle}>
              Iniciar Sesión
            </Text>
            <Text variant="bodySmall" color="muted" style={styles.formSubtitle}>
              Ingresá tus datos para continuar
            </Text>

            {/* Email Field */}
            <FormField
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              placeholder="tu@email.com"
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password Field */}
            <PasswordInput
              label="Contraseña"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              error={errors.password}
            />

            {/* Forgot Password */}
            <View style={styles.forgotPassword}>
              <Text
                variant="bodySmall"
                color="primary"
                style={styles.forgotPasswordText}
                onPress={() => setForgotPasswordVisible(true)}
              >
                ¿Olvidaste tu contraseña?
              </Text>
            </View>

            {/* Login Button */}
            <AuthButton
              provider="email"
              customLabel="Ingresar"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
            />

            {hasOAuthOptions && (
              <>
                {/* Divider */}
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

            {/* Register Link */}
            <View style={styles.registerSection}>
              <Text variant="body" color="muted">
                ¿No tenés cuenta?{' '}
              </Text>
              <Text
                variant="body"
                color="primary"
                style={styles.registerLink}
                onPress={() => navigation.navigate('Register')}
              >
                Registrate
              </Text>
            </View>
          </AuthForm>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotPasswordVisible}
        onClose={() => setForgotPasswordVisible(false)}
        title="Recuperar Contraseña"
        type="info"
      >
        <Text variant="body" color="muted" style={styles.modalText}>
          Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
        </Text>
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Modal>

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
    flexGrow: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logo: {
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  form: {
    paddingVertical: SPACING.lg,
  },
  formTitle: {
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  formSubtitle: {
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotPasswordText: {
    fontWeight: '500',
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
    marginBottom: SPACING.lg,
  },
  oauthSpacer: {
    height: SPACING.sm,
  },
  registerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerLink: {
    fontWeight: '600',
  },
  modalText: {
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
});

export default LoginScreen;
