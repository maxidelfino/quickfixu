// src/routes/category.routes.ts
// Category routes - /api/categories/*

import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';

const router = Router();

// All category routes are public (no auth required)

/**
 * GET /api/categories
 * Get all categories (public)
 */
router.get('/', categoryController.getAll);

/**
 * GET /api/categories/:slug
 * Get category by slug (public)
 * Note: Must be BEFORE /:slug/professionals to avoid conflict
 */
router.get('/:slug', categoryController.getBySlug);

/**
 * GET /api/categories/:slug/professionals
 * Get all professionals in a category (public)
 * Optional query params: lat, lng, radius (km) for location filtering
 */
router.get('/:slug/professionals', categoryController.getProfessionals);

export default router;
