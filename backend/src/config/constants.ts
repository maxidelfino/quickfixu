// src/config/constants.ts
// Application-wide constants

export const AUTH_CONSTANTS = {
  // JWT
  ACCESS_TOKEN_EXPIRY: '15m', // 15 minutes
  REFRESH_TOKEN_EXPIRY_DAYS: 7, // 7 days

  // Password hashing
  BCRYPT_COST_FACTOR: 12, // ~300ms on modern CPU

  // Rate limiting
  AUTH_RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 10, // Max 10 auth attempts per window
  GLOBAL_RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  GLOBAL_RATE_LIMIT_MAX_REQUESTS: 100,
} as const;

export const UPLOAD_CONSTANTS = {
  // Profile photos
  PROFILE_PHOTO_MAX_SIZE: 5 * 1024 * 1024, // 5 MB
  PROFILE_PHOTO_DIMENSIONS: { width: 800, height: 800 },
  PROFILE_PHOTO_QUALITY: 80, // JPEG quality 0-100

  // Certifications
  CERTIFICATION_MAX_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOC_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
} as const;

export const GEOCODING_CONSTANTS = {
  CACHE_TTL_SECONDS: 90 * 24 * 60 * 60, // 90 days
  NOMINATIM_TIMEOUT_MS: 5000, // 5 seconds
  GOOGLE_TIMEOUT_MS: 5000,
} as const;

export const API_CONSTANTS = {
  DEFAULT_PORT: 3000,
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
} as const;
