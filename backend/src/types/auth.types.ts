// src/types/auth.types.ts
// Authentication-related type definitions and DTOs

export type AuthProvider = 'email' | 'google' | 'facebook';
export type UserRole = 'client' | 'professional';

export interface RegisterDto {
  fullName: string;
  email: string;
  password?: string; // Optional for OAuth
  phone: string;
  dni: string;
  address: string;
  
  // Professional fields (optional)
  yearsExperience?: number;
  description?: string;
  categoryIds?: number[];
  
  // OAuth fields (populated by OAuth flow)
  authProvider?: AuthProvider;
  oauthId?: string;
  profilePhotoUrl?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface OAuthGoogleDto {
  idToken: string; // JWT from Google Sign-In SDK
}

export interface OAuthFacebookDto {
  accessToken: string; // Access token from Facebook SDK
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface UserResponse {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  dni: string;
  address: string;
  latitude: number;
  longitude: number;
  profilePhotoUrl?: string;
  rating: number;
  ratingCount: number;
  role: UserRole;
  professional?: ProfessionalResponse;
  createdAt: Date;
}

export interface ProfessionalResponse {
  id: number;
  yearsExperience: number;
  description: string;
  categories: CategoryResponse[];
  certifications: CertificationResponse[];
}

export interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

export interface CertificationResponse {
  id: number;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: Date;
}

export interface GoogleTokenPayload {
  sub: string; // Google user ID
  email: string;
  name: string;
  picture?: string;
  aud: string; // Audience (must match one allowed Google client ID)
}

export interface FacebookProfileResponse {
  id: string; // Facebook user ID
  email?: string;
  name: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}
