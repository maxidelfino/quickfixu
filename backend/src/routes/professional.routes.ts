// src/routes/professional.routes.ts
// Professional routes - /api/professionals/*

import { Router } from 'express';
import { professionalController } from '../controllers/professional.controller';
import { requireAuth, isProfessional } from '../middleware/auth.middleware';
import { uploadCertification, handleMulterError } from '../middleware/multer.middleware';

const router = Router();

// ============================================================
// PUBLIC ROUTES (no auth required)
// ============================================================

/**
 * GET /api/professionals/search
 * Search professionals by location (public)
 * Query: lat, lng, radius (km), categoryId?
 */
router.get('/search', professionalController.searchByLocation);

/**
 * GET /api/professionals/:id
 * Get public professional profile by ID (public)
 * Note: Must be AFTER /search to avoid :id matching 'search'
 */
router.get('/:id([0-9]+)', professionalController.getPublicProfile);

// ============================================================
// PROTECTED - PROFESSIONAL ONLY ROUTES
// ============================================================

router.use(requireAuth, isProfessional);

/**
 * GET /api/professionals/me
 * Get own professional profile (requires professional role)
 */
router.get('/me', professionalController.getMyProfile);

/**
 * PATCH /api/professionals/me
 * Update description, yearsExperience, categories (requires professional role)
 * Body: { description?, yearsExperience?, categoryIds? }
 */
router.patch('/me', professionalController.updateMyProfile);

/**
 * GET /api/professionals/me/certifications
 * List own certifications (requires professional role)
 */
router.get('/me/certifications', professionalController.getMyCertifications);

/**
 * POST /api/professionals/me/certifications
 * Upload a certification document (requires professional role)
 * Content-Type: multipart/form-data
 * Field: 'certification' (required, max 10MB, PDF/JPEG/PNG)
 */
router.post(
  '/me/certifications',
  (req, res, next) => {
    uploadCertification(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  professionalController.uploadCertification
);

/**
 * DELETE /api/professionals/me/certifications/:id
 * Soft-delete a certification (only pending ones, requires professional role)
 */
router.delete('/me/certifications/:id', professionalController.deleteCertification);

export default router;
