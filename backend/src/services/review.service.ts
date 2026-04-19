// src/services/review.service.ts
// Review service - Public reviews API for V1

import prisma from '../config/database';
import { AppError } from '../types/errors.types';

// ============================================================
// DTOs
// ============================================================

export interface ReviewResponse {
  id: number;
  appointmentId: number;
  reviewerUserId: number;
  reviewerFullName: string;
  reviewerProfilePhotoUrl: string | null;
  reviewedUserId: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface ReviewsByProfessionalResponse {
  professionalId: number;
  reviews: ReviewResponse[];
  total: number;
}

// ============================================================
// SERVICE
// ============================================================

class ReviewService {
  /**
   * Get all public reviews for a professional (reviews they received)
   * Reviews are linked through appointments, and we filter to completed appointments
   * where the professional is the reviewed user
   */
  async getReviewsByProfessional(professionalId: number): Promise<ReviewsByProfessionalResponse> {
    // First verify professional exists
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      throw new AppError(404, 'Professional not found');
    }

    // Hardened domain scoping: reviews are tied to completed appointments
    // that originated from THIS professional's proposal.
    //
    // The chain appointment→proposal→professional is verified explicitly:
    // - review.reviewedUserId = professional.userId  (the reviewed user is this professional-as-user)
    // - appointment.proposal.professionalId = professional.id  (the proposal was made by THIS professional)
    // - appointment.status = 'completed'              (completion confirmation per V1 domain rule)
    // - appointment.completedAt IS NOT NULL          (bilateral confirmation timestamps exist)
    //
    // This prevents false positives: a review is only returned if the professional
    // actually created the proposal that led to the appointment being completed.
    const reviews = await prisma.review.findMany({
      where: {
        reviewedUserId: professional.userId,
        appointment: {
          proposal: {
            professionalId: professionalId,
          },
          status: 'completed',
          completedAt: { not: null },
        },
      },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            profilePhotoUrl: true,
          },
        },
        appointment: {
          select: {
            id: true,
            status: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const reviewResponses: ReviewResponse[] = reviews.map((review) => ({
      id: review.id,
      appointmentId: review.appointmentId,
      reviewerUserId: review.reviewerUserId,
      reviewerFullName: review.reviewer.fullName,
      reviewerProfilePhotoUrl: review.reviewer.profilePhotoUrl,
      reviewedUserId: review.reviewedUserId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    }));

    return {
      professionalId,
      reviews: reviewResponses,
      total: reviewResponses.length,
    };
  }

  /**
   * Get all public reviews written by a specific user (client reviews they gave)
   * Used to display a user's activity/history
   */
  async getReviewsByUser(userId: number): Promise<ReviewResponse[]> {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Scoped to completed appointments only — V1 domain rule:
    // reviews are only eligible after completion confirmation (bilateral)
    const reviews = await prisma.review.findMany({
      where: {
        reviewerUserId: userId,
        appointment: {
          status: 'completed',
          completedAt: { not: null },
        },
      },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            profilePhotoUrl: true,
          },
        },
        appointment: {
          select: {
            id: true,
            status: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => ({
      id: review.id,
      appointmentId: review.appointmentId,
      reviewerUserId: review.reviewerUserId,
      reviewerFullName: review.reviewer.fullName,
      reviewerProfilePhotoUrl: review.reviewer.profilePhotoUrl,
      reviewedUserId: review.reviewedUserId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    }));
  }
}

export const reviewService = new ReviewService();