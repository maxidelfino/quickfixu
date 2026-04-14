// src/routes/auth.routes.ts
// Auth routes - /api/auth/*

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import {
  validateBody,
  registerSchema,
  loginSchema,
  oauthGoogleSchema,
  oauthFacebookSchema,
  refreshTokenSchema,
  logoutSchema,
} from '../middleware/validation.middleware';

const router = Router();

/**
 * POST /api/auth/register
 * Register new user (client or professional)
 * Body: { fullName, email, password, phone, dni, address, yearsExperience?, description?, categoryIds? }
 */
router.post(
  '/register',
  validateBody(registerSchema),
  authController.register
);

/**
 * POST /api/auth/login
 * Login with email/password
 * Body: { email, password }
 */
router.post(
  '/login',
  validateBody(loginSchema),
  authController.login
);

/**
 * POST /api/auth/google
 * OAuth Google sign-in
 * Body: { idToken }
 */
router.post(
  '/google',
  validateBody(oauthGoogleSchema),
  authController.oauthGoogle
);

/**
 * POST /api/auth/facebook
 * OAuth Facebook sign-in
 * Body: { accessToken }
 */
router.post(
  '/facebook',
  validateBody(oauthFacebookSchema),
  authController.oauthFacebook
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 * Body: { refreshToken }
 */
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  authController.refresh
);

/**
 * POST /api/auth/logout
 * Revoke refresh token
 * Body: { refreshToken }
 */
router.post(
  '/logout',
  validateBody(logoutSchema),
  authController.logout
);

export default router;
