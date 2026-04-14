// src/controllers/professional.controller.ts
// Professional controller - HTTP handlers for /api/professionals/* routes

import { Request, Response, NextFunction } from 'express';
import { professionalService } from '../services/professional.service';
import { AppError } from '../types/errors.types';

class ProfessionalController {
  /**
   * GET /api/professionals/me
   * Get own professional profile (requires professional role)
   */
  async getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await professionalService.getProfessionalProfile(userId);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/professionals/me
   * Update description, yearsExperience, and/or categories (requires professional role)
   * Body: { description?, yearsExperience?, categoryIds? }
   */
  async updateMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { description, yearsExperience, categoryIds } = req.body;

      // Validate description if provided
      if (description !== undefined) {
        if (typeof description !== 'string') {
          throw new AppError(400, 'description must be a string');
        }
        if (description.length < 10 || description.length > 500) {
          throw new AppError(400, 'description must be between 10 and 500 characters');
        }
      }

      // Validate yearsExperience if provided
      if (yearsExperience !== undefined) {
        const years = parseInt(String(yearsExperience), 10);
        if (isNaN(years) || years < 0 || !Number.isInteger(years)) {
          throw new AppError(400, 'yearsExperience must be a non-negative integer');
        }
        req.body.yearsExperience = years;
      }

      // Update profile fields
      let profile = await professionalService.updateProfessionalProfile(userId, {
        description,
        yearsExperience: req.body.yearsExperience,
      });

      // Update categories if provided (separate operation)
      if (categoryIds !== undefined) {
        if (!Array.isArray(categoryIds)) {
          throw new AppError(400, 'categoryIds must be an array');
        }
        const ids = categoryIds
          .map((id: string | number) => parseInt(String(id), 10))
          .filter((id: number) => !isNaN(id));

        profile = await professionalService.updateCategories(userId, ids);
      }

      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/professionals/:id
   * Get public professional profile by ID (no auth required)
   */
  async getPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const professionalId = parseInt(req.params.id, 10);

      if (isNaN(professionalId)) {
        throw new AppError(400, 'Invalid professional ID');
      }

      const profile = await professionalService.getPublicProfile(professionalId);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/professionals/me/certifications
   * Upload a certification document (requires professional role)
   * Content-Type: multipart/form-data
   * Field: 'certification' (required)
   */
  async uploadCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      if (!req.file) {
        throw new AppError(400, 'No file provided. Upload a file with field name "certification".');
      }

      const certification = await professionalService.uploadCertification(userId, req.file);

      res.status(201).json(certification);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/professionals/me/certifications
   * List own certifications (requires professional role)
   */
  async getMyCertifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const certifications = await professionalService.getCertifications(userId);
      res.status(200).json(certifications);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/professionals/me/certifications/:id
   * Soft-delete a certification (only pending ones, requires professional role)
   */
  async deleteCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const certId = parseInt(req.params.id, 10);

      if (isNaN(certId)) {
        throw new AppError(400, 'Invalid certification ID');
      }

      await professionalService.deleteCertification(userId, certId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/professionals/search
   * Search professionals by location and optional category (public)
   * Query params: lat, lng, radius (km), categoryId?
   */
  async searchByLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng, radius, categoryId } = req.query;

      // Validate required params
      if (!lat || !lng || !radius) {
        throw new AppError(400, 'lat, lng, and radius are required query parameters');
      }

      const latitude = parseFloat(String(lat));
      const longitude = parseFloat(String(lng));
      const radiusKm = parseFloat(String(radius));

      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        throw new AppError(400, 'lat must be a valid number between -90 and 90');
      }
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        throw new AppError(400, 'lng must be a valid number between -180 and 180');
      }
      if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 200) {
        throw new AppError(400, 'radius must be a positive number up to 200 km');
      }

      let parsedCategoryId: number | undefined;
      if (categoryId !== undefined) {
        parsedCategoryId = parseInt(String(categoryId), 10);
        if (isNaN(parsedCategoryId)) {
          throw new AppError(400, 'categoryId must be a valid integer');
        }
      }

      const results = await professionalService.searchByLocation(
        latitude,
        longitude,
        radiusKm,
        parsedCategoryId
      );

      res.status(200).json({
        count: results.length,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const professionalController = new ProfessionalController();
