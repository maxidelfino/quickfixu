// mobile/src/hooks/useOAuth.ts
// OAuth hooks for Google and Facebook sign-in

import { useState, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { Alert } from 'react-native';
import { authService } from '../services';
import { oauthService } from '../services/oauth';
import { useAuthStore } from '../stores/authStore';
import { AuthResponse } from '../types';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CONFIGURED = oauthService.isGoogleConfigured();
const FACEBOOK_CONFIGURED = oauthService.isFacebookConfigured();

const useDisabledAuthRequest = () => {
  const promptAsync = useCallback(async () => null, []);

  return [null, null, promptAsync] as const;
};

const useGoogleAuthRequest = GOOGLE_CONFIGURED
  ? Google.useAuthRequest
  : useDisabledAuthRequest;

const useFacebookAuthRequest = FACEBOOK_CONFIGURED
  ? Facebook.useAuthRequest
  : useDisabledAuthRequest;

interface OAuthState {
  isLoading: boolean;
  error: string | null;
}

interface UseOAuthReturn {
  // Google
  signInWithGoogle: () => Promise<AuthResponse | null>;
  isGoogleLoading: boolean;
  isGoogleConfigured: boolean;
  
  // Facebook
  signInWithFacebook: () => Promise<AuthResponse | null>;
  isFacebookLoading: boolean;
  isFacebookConfigured: boolean;
  
  // Common
  isLoading: boolean;
  error: string | null;
}

export const useOAuth = (): UseOAuthReturn => {
  const { login } = useAuthStore();
  const [googleRequest, , promptGoogleAsync] = useGoogleAuthRequest(
    oauthService.googleRequestConfig
  );
  const [facebookRequest, , promptFacebookAsync] = useFacebookAuthRequest(
    oauthService.facebookRequestConfig
  );
  
  const [googleState, setGoogleState] = useState<OAuthState>({
    isLoading: false,
    error: null,
  });
  
  const [facebookState, setFacebookState] = useState<OAuthState>({
    isLoading: false,
    error: null,
  });

  const signInWithGoogle = useCallback(async (): Promise<AuthResponse | null> => {
    if (!GOOGLE_CONFIGURED) {
      Alert.alert(
        'Próximamente',
        'OAuth credentials not configured yet. Coming soon!',
        [{ text: 'OK' }]
      );
      return null;
    }

    setGoogleState({ isLoading: true, error: null });

    try {
      if (!googleRequest) {
        throw new Error('Google OAuth no está listo todavía');
      }

      const result = await promptGoogleAsync();
      const idToken = result?.type === 'success' ? result.params?.id_token : undefined;

      if (!idToken) {
        return null;
      }

      const response = await authService.loginWithGoogle(idToken);
      
      if (response) {
        // Store user and token in auth store
        const token = response.tokens?.accessToken || response.token;
        login(response.user, token);
        
        // Optionally store refresh token
        // In a real app, you'd store this securely (e.g., react-native-keychain)
      }
      
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Error al iniciar sesión con Google';
      setGoogleState({ isLoading: false, error: errorMessage });
      
      Alert.alert('Error', errorMessage);
      return null;
    } finally {
      setGoogleState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [googleRequest, login, promptGoogleAsync]);

  const signInWithFacebook = useCallback(async (): Promise<AuthResponse | null> => {
    if (!FACEBOOK_CONFIGURED) {
      Alert.alert(
        'Próximamente',
        'OAuth credentials not configured yet. Coming soon!',
        [{ text: 'OK' }]
      );
      return null;
    }

    setFacebookState({ isLoading: true, error: null });

    try {
      if (!facebookRequest) {
        throw new Error('Facebook OAuth no está listo todavía');
      }

      const result = await promptFacebookAsync();
      const accessToken = result?.type === 'success' ? result.params?.access_token : undefined;

      if (!accessToken) {
        return null;
      }

      const response = await authService.loginWithFacebook(accessToken);
      
      if (response) {
        // Store user and token in auth store
        const token = response.tokens?.accessToken || response.token;
        login(response.user, token);
        
        // Optionally store refresh token
        // In a real app, you'd store this securely (e.g., react-native-keychain)
      }
      
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Error al iniciar sesión con Facebook';
      setFacebookState({ isLoading: false, error: errorMessage });
      
      Alert.alert('Error', errorMessage);
      return null;
    } finally {
      setFacebookState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [facebookRequest, login, promptFacebookAsync]);

  return {
    // Google
    signInWithGoogle,
    isGoogleLoading: googleState.isLoading,
    isGoogleConfigured: GOOGLE_CONFIGURED,
    
    // Facebook
    signInWithFacebook,
    isFacebookLoading: facebookState.isLoading,
    isFacebookConfigured: FACEBOOK_CONFIGURED,
    
    // Common
    isLoading: googleState.isLoading || facebookState.isLoading,
    error: googleState.error || facebookState.error,
  };
};
