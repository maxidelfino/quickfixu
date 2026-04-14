// src/middleware/validation.middleware.ts
// Zod schema validation middleware

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../types/errors.types';

/**
 * Validate request body with Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return next(new ValidationError(details));
      }
      next(error);
    }
  };
};

/**
 * Validate request query params with Zod schema
 */
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return next(new ValidationError(details));
      }
      next(error);
    }
  };
};

/**
 * Validate request params with Zod schema
 */
export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return next(new ValidationError(details));
      }
      next(error);
    }
  };
};

// ============================================================
// AUTH VALIDATION SCHEMAS
// ============================================================

/**
 * Register schema
 * Argentine phone format: +54 9 11 1234-5678 or +54 9 221 123-4567
 * DNI: 7-8 digits
 */
export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least 1 special character'),
  phone: z
    .string()
    .regex(
      /^\+54 9 (11|[2-9]\d{1,2}) \d{4}-\d{4}$/,
      'Invalid phone format. Use: +54 9 11 1234-5678'
    ),
  dni: z
    .string()
    .regex(/^\d{7,8}$/, 'DNI must be 7-8 digits'),
  address: z
    .string()
    .min(10, 'Address must be at least 10 characters'),
  // Professional fields (optional)
  yearsExperience: z
    .number()
    .int()
    .min(0, 'Years of experience cannot be negative')
    .max(50, 'Years of experience cannot exceed 50')
    .optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  categoryIds: z
    .array(z.number().int().positive('Category ID must be positive'))
    .min(1, 'At least one category is required for professionals')
    .max(3, 'Maximum 3 categories allowed')
    .optional(),
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * OAuth Google schema
 */
export const oauthGoogleSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

/**
 * OAuth Facebook schema
 */
export const oauthFacebookSchema = z.object({
  accessToken: z.string().min(1, 'Facebook access token is required'),
});

/**
 * Refresh token schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Logout schema
 */
export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ============================================================
// USER VALIDATION SCHEMAS
// ============================================================

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  phone: z
    .string()
    .regex(
      /^\+54 9 (11|[2-9]\d{1,2}) \d{4}-\d{4}$/,
      'Invalid phone format. Use: +54 9 11 1234-5678'
    )
    .optional(),
  address: z
    .string()
    .min(10, 'Address must be at least 10 characters')
    .optional(),
});

// ============================================================
// PROFESSIONAL VALIDATION SCHEMAS
// ============================================================

/**
 * Update professional profile schema
 */
export const updateProfessionalSchema = z.object({
  yearsExperience: z
    .number()
    .int()
    .min(0, 'Years of experience cannot be negative')
    .max(50, 'Years of experience cannot exceed 50')
    .optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  categoryIds: z
    .array(z.number().int().positive('Category ID must be positive'))
    .min(1, 'At least one category is required')
    .max(3, 'Maximum 3 categories allowed')
    .optional(),
});
