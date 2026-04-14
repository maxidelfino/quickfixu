// src/services/auth.service.ts
// Authentication service - JWT creation, OAuth verification, refresh token rotation

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import axios from 'axios';
import { signToken } from '../config/jwt';
import prisma from '../config/database';
import { AppError } from '../types/errors.types';
import { geocodingService } from './geocoding.service';
import {
  RegisterDto,
  OAuthGoogleDto,
  OAuthFacebookDto,
  AuthResponse,
  UserResponse,
  UserRole,
  CategoryResponse,
  CertificationResponse,
} from '../types/auth.types';

class AuthService {
  private isMockOAuthAllowed(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      (process.env.NODE_ENV === 'development' &&
        process.env.ALLOW_MOCK_OAUTH_TOKENS === 'true')
    );
  }

  /**
   * Register new user (client or professional)
   */
  async register(data: RegisterDto): Promise<AuthResponse> {
    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, 'Email already registered');
    }

    // Geocode address
    const { latitude, longitude } = await geocodingService.geocode(data.address);

    // Hash password (skip for OAuth)
    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12); // Cost factor 12
    }

    // Determine if professional (has categoryIds)
    const isProfessional = Boolean(data.categoryIds && data.categoryIds.length > 0);

    // Create user + professional in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          passwordHash,
          phone: data.phone,
          dni: data.dni,
          address: data.address,
          latitude,
          longitude,
          authProvider: data.authProvider || 'email',
          oauthId: data.oauthId,
          profilePhotoUrl: data.profilePhotoUrl,
        },
      });

      // Create professional record + categories if applicable
      if (isProfessional) {
        const professional = await tx.professional.create({
          data: {
            userId: newUser.id,
            yearsExperience: data.yearsExperience!,
            description: data.description!,
          },
        });

        // Create professional_categories links
        await tx.professionalCategory.createMany({
          data: data.categoryIds!.map((categoryId) => ({
            professionalId: professional.id,
            categoryId,
          })),
        });
      }

      return newUser;
    });

    // Generate tokens
    const accessToken = signToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: await this.getUserWithRole(user.id),
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Login with email/password
   * Timing attack protection: always compare hash even if user doesn't exist
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    // Fetch user
    const user = await prisma.user.findUnique({ where: { email } });

    // Timing attack protection: always compare hash even if user doesn't exist
    const dummyHash = '$2b$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // 60 chars like bcrypt
    const hash = user?.passwordHash || dummyHash;
    const isValid = await bcrypt.compare(password, hash);

    if (!user || !isValid) {
      throw new AppError(401, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new AppError(403, 'Account is blocked. Contact support.');
    }

    // Generate tokens
    const accessToken = signToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: await this.getUserWithRole(user.id),
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * OAuth Google sign-in
   * For MVP: simple mock verification (real verification in Sprint 3)
   */
  async oauthGoogle(data: OAuthGoogleDto): Promise<AuthResponse> {
    // Verify token with Google (or mock for MVP)
    const payload = await this.verifyGoogleToken(data.idToken);

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (user && user.authProvider !== 'google') {
      throw new AppError(
        409,
        'Email already registered with email/password. Account linking not supported in MVP.'
      );
    }

    if (!user) {
      // Create new user with default Argentina location
      const { latitude, longitude } = await geocodingService.geocode('Argentina');

      user = await prisma.user.create({
        data: {
          fullName: payload.name,
          email: payload.email,
          authProvider: 'google',
          oauthId: payload.sub,
          profilePhotoUrl: payload.picture,
          phone: '', // Will update in profile edit
          dni: '', // Will update in profile edit
          address: 'Argentina',
          latitude,
          longitude,
        },
      });
    }

    const accessToken = signToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: await this.getUserWithRole(user.id),
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * OAuth Facebook sign-in
   * For MVP: simple mock verification (real verification in Sprint 3)
   */
  async oauthFacebook(data: OAuthFacebookDto): Promise<AuthResponse> {
    // Verify token and fetch profile (or mock for MVP)
    const profile = await this.verifyFacebookToken(data.accessToken);

    if (!profile.email) {
      throw new AppError(
        400,
        'Email permission required. Please allow email access in Facebook settings.'
      );
    }

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (user && user.authProvider !== 'facebook') {
      throw new AppError(409, 'Email already registered with different provider.');
    }

    if (!user) {
      const { latitude, longitude } = await geocodingService.geocode('Argentina');

      user = await prisma.user.create({
        data: {
          fullName: profile.name,
          email: profile.email,
          authProvider: 'facebook',
          oauthId: profile.id,
          profilePhotoUrl: profile.picture?.data?.url,
          phone: '',
          dni: '',
          address: 'Argentina',
          latitude,
          longitude,
        },
      });
    }

    const accessToken = signToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: await this.getUserWithRole(user.id),
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Refresh access token
   * Implements token rotation and reuse detection
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new AppError(401, 'Invalid refresh token');
    }

    if (storedToken.isRevoked) {
      // Token reuse detected → revoke all tokens for user (security breach)
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { isRevoked: true },
      });
      throw new AppError(
        401,
        'Token reuse detected. All sessions invalidated for security.'
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AppError(401, 'Refresh token expired. Please login again.');
    }

    // Rotate token: revoke old, create new
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const newAccessToken = signToken(storedToken.userId);
    const newRefreshToken = await this.createRefreshToken(storedToken.userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout (revoke refresh token)
   * Idempotent: doesn't fail if token doesn't exist
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Idempotent: don't fail if token doesn't exist
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  }

  /**
   * Create refresh token (UUID, hashed in DB)
   * @returns Plaintext UUID (only time it's visible)
   */
  async createRefreshToken(userId: number): Promise<string> {
    const token = uuidv4();
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Verify Google ID token
   * Mock tokens are only accepted in explicit test/dev flows
   */
  private async verifyGoogleToken(idToken: string): Promise<{
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    const expectedAudiences = this.getGoogleAllowedAudiences();

    if (expectedAudiences.length === 0) {
      throw new AppError(
        500,
        'Google OAuth is not configured. Set GOOGLE_CLIENT_IDS and/or GOOGLE_CLIENT_ID to validate token audiences.'
      );
    }

    try {
      // Try real Google verification first
      const response = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
        { timeout: 5000 }
      );
      const payload = response.data;

      // Verify audience against the explicit allowlist of Google client IDs.
      if (!expectedAudiences.includes(payload.aud)) {
        throw new AppError(401, 'Invalid Google token audience');
      }

      return payload;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      if (idToken.startsWith('mock_google_') && this.isMockOAuthAllowed()) {
        const parts = idToken.split('_');
        return {
          sub: parts[2] || 'mock_user_id',
          email: parts[3] || 'user@example.com',
          name: parts[4] || 'Mock User',
          picture: undefined,
        };
      }

      // Real error (not mock)
      if (error.response?.status === 400) {
        throw new AppError(401, 'Invalid Google authentication token');
      }
      throw error;
    }
  }

  private getGoogleAllowedAudiences(): string[] {
    const configuredAudiences = [
      ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
      process.env.GOOGLE_CLIENT_ID || '',
    ]
      .map((value) => value.trim())
      .filter(Boolean);

    return [...new Set(configuredAudiences)];
  }

  /**
   * Verify Facebook access token
   * Mock tokens are only accepted in explicit test/dev flows
   */
  private async verifyFacebookToken(accessToken: string): Promise<{
    id: string;
    email?: string;
    name: string;
    picture?: { data?: { url?: string } };
  }> {
    try {
      // Try real Facebook verification first
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;

      if (appId && appSecret) {
        const debugResponse = await axios.get(
          `https://graph.facebook.com/debug_token`,
          {
            params: {
              input_token: accessToken,
              access_token: `${appId}|${appSecret}`,
            },
            timeout: 5000,
          }
        );

        if (!debugResponse.data.data?.is_valid) {
          throw new AppError(401, 'Invalid Facebook token');
        }

        // Fetch profile
        const profileResponse = await axios.get(
          `https://graph.facebook.com/me`,
          {
            params: {
              fields: 'id,name,email,picture',
              access_token: accessToken,
            },
            timeout: 5000,
          }
        );

        return profileResponse.data;
      }

      throw new Error('Facebook credentials not configured');
    } catch (error: any) {
      if (
        accessToken.startsWith('mock_facebook_') &&
        this.isMockOAuthAllowed()
      ) {
        const parts = accessToken.split('_');
        return {
          id: parts[2] || 'mock_fb_id',
          email: parts[3] || 'user@example.com',
          name: parts[4] || 'Mock FB User',
          picture: undefined,
        };
      }

      // Real error (not mock)
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Invalid Facebook authentication token');
    }
  }

  /**
   * Get user with role (professional data if exists)
   */
  private async getUserWithRole(userId: number): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        professional: {
          include: {
            categories: {
              include: {
                category: true,
              },
            },
            certifications: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const role: UserRole = user.professional ? 'professional' : 'client';

    const userResponse: UserResponse = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      dni: user.dni,
      address: user.address,
      latitude: Number(user.latitude),
      longitude: Number(user.longitude),
      profilePhotoUrl: user.profilePhotoUrl || undefined,
      rating: Number(user.rating),
      ratingCount: user.ratingCount,
      role,
      createdAt: user.createdAt,
    };

    if (user.professional) {
      const categories: CategoryResponse[] = user.professional.categories.map(
        (pc) => ({
          id: pc.category.id,
          name: pc.category.name,
          slug: pc.category.slug,
          icon: pc.category.icon,
        })
      );

      const certifications: CertificationResponse[] =
        user.professional.certifications.map((cert) => ({
          id: cert.id,
          fileUrl: cert.fileUrl,
          status: cert.status as 'pending' | 'approved' | 'rejected',
          uploadedAt: cert.uploadedAt,
        }));

      userResponse.professional = {
        id: user.professional.id,
        yearsExperience: user.professional.yearsExperience,
        description: user.professional.description,
        categories,
        certifications,
      };
    }

    return userResponse;
  }
}

export const authService = new AuthService();
