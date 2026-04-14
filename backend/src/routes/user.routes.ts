// src/routes/user.routes.ts
// User routes - /api/users/*

import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadProfilePhoto, handleMulterError } from '../middleware/multer.middleware';

const router = Router();

// ============================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================

router.use(requireAuth);

/**
 * GET /api/users/me
 * Get authenticated user's profile
 */
router.get('/me', userController.getProfile);

/**
 * PATCH /api/users/me
 * Update authenticated user's profile
 * Body: { fullName?, phone?, address?, yearsExperience?, description?, categoryIds? }
 */
router.patch('/me', userController.updateProfile);

/**
 * POST /api/users/me/photo
 * Upload profile photo
 * Content-Type: multipart/form-data
 * Field: 'photo' (required)
 */
router.post(
  '/me/photo',
  (req, res, next) => {
    uploadProfilePhoto(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  userController.uploadPhoto
);

/**
 * DELETE /api/users/me
 * Delete authenticated user's account
 */
router.delete('/me', userController.deleteAccount);

export default router;
