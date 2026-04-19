// src/controllers/review.controller.ts
// Review controller - HTTP handlers for public reviews API

import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';
import { AppError } from '../types/errors.types';

class ReviewController {
  /**
   * GET /api/professionals/:id/reviews
   * Get all public reviews for a professional (public - no auth required)
   */
  async getReviewsByProfessional(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const professionalId = parseInt(req.params.id, 10);

      if (isNaN(professionalId)) {
        throw new AppError(400, 'Invalid professional ID');
      }

      const result = await reviewService.getReviewsByProfessional(professionalId);

      res.status(200).json({
        professionalId: result.professionalId,
        reviews: result.reviews,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reviewController = new ReviewController();