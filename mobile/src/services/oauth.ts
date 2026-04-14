// mobile/src/services/oauth.ts
// OAuth request configuration and backend token verification

import { makeRedirectUri, ResponseType } from 'expo-auth-session';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/config';
import { AuthResponse } from '../types';
import { normalizeAuthResponse } from './auth';

const readConfiguredValue = (value?: string): string | undefined => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue.startsWith('YOUR_') || normalizedValue.startsWith('your_')) {
    return undefined;
  }

  return normalizedValue;
};

const GOOGLE_CLIENT_ID = readConfiguredValue(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
const GOOGLE_ANDROID_CLIENT_ID = readConfiguredValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
const GOOGLE_IOS_CLIENT_ID = readConfiguredValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

const FACEBOOK_APP_ID = readConfiguredValue(process.env.EXPO_PUBLIC_FACEBOOK_APP_ID);

export interface OAuthProvider {
  name: 'google' | 'facebook';
  idToken?: string;
  accessToken?: string;
}

const redirectUri = makeRedirectUri({
  scheme: 'quickfixu',
  path: 'auth',
});

class OAuthService {
  readonly googleRequestConfig = {
    ...(GOOGLE_CLIENT_ID ? { clientId: GOOGLE_CLIENT_ID } : {}),
    ...(GOOGLE_ANDROID_CLIENT_ID ? { androidClientId: GOOGLE_ANDROID_CLIENT_ID } : {}),
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    redirectUri,
    responseType: ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
  };

  readonly facebookRequestConfig = {
    ...(FACEBOOK_APP_ID ? { clientId: FACEBOOK_APP_ID } : {}),
    redirectUri,
    responseType: ResponseType.Token,
    scopes: ['public_profile', 'email'],
  };

  /**
   * Send Google ID token to backend for verification
   */
  async verifyGoogleToken(idToken: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Google authentication failed' }));
      throw new Error(error.message || 'Google authentication failed');
    }

    return normalizeAuthResponse(await response.json());
  }

  /**
   * Send Facebook access token to backend for verification
   */
  async verifyFacebookToken(accessToken: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/facebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Facebook authentication failed' }));
      throw new Error(error.message || 'Facebook authentication failed');
    }

    return normalizeAuthResponse(await response.json());
  }

  /**
   * Check if OAuth credentials are configured
   */
  isGoogleConfigured(): boolean {
    if (Platform.OS === 'ios') {
      return Boolean(GOOGLE_IOS_CLIENT_ID);
    }

    if (Platform.OS === 'android') {
      return Boolean(GOOGLE_ANDROID_CLIENT_ID);
    }

    return Boolean(GOOGLE_CLIENT_ID);
  }

  isFacebookConfigured(): boolean {
    return Boolean(FACEBOOK_APP_ID);
  }
}

export const oauthService = new OAuthService();
