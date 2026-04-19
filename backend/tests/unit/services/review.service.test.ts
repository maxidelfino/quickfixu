// tests/unit/services/review.service.test.ts
// Unit tests for ReviewService - Public reviews API

import prisma from '../../../src/config/database';

const mockPrisma = prisma as any;

describe('ReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReviewsByProfessional', () => {
    const mockProfessional = {
      id: 10,
      userId: 1,
      yearsExperience: 5,
      description: 'Plomero con experiencia',
    };

    const mockReviewer = {
      id: 2,
      fullName: 'María García',
      profilePhotoUrl: 'https://example.com/photo.jpg',
    };

    const mockCompletedAppointment = {
      id: 100,
      status: 'completed',
      completedAt: new Date('2024-01-15'),
    };

    const mockReview = {
      id: 1,
      appointmentId: 100,
      reviewerUserId: 2,
      reviewedUserId: 1,
      rating: 5,
      comment: 'Excelente trabajo',
      createdAt: new Date('2024-01-16'),
      reviewer: mockReviewer,
      appointment: mockCompletedAppointment,
    };

    it('should return reviews for a professional with valid completed appointments', async () => {
      // Arrange
      mockPrisma.professional.findUnique.mockResolvedValue(mockProfessional);
      mockPrisma.review.findMany.mockResolvedValue([mockReview]);

      // Import service after mocks are set
      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByProfessional(10);

      // Assert
      expect(result.professionalId).toBe(10);
      expect(result.reviews).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.reviews[0]).toMatchObject({
        id: 1,
        appointmentId: 100,
        reviewerUserId: 2,
        reviewerFullName: 'María García',
        reviewerProfilePhotoUrl: 'https://example.com/photo.jpg',
        rating: 5,
        comment: 'Excelente trabajo',
      });
    });

    it('should filter out reviews from non-completed appointments', async () => {
      // Arrange: Prisma now handles completion gating at query level
      // So mock returns ONLY completed reviews from the start
      mockPrisma.professional.findUnique.mockResolvedValue(mockProfessional);
      mockPrisma.review.findMany.mockResolvedValue([mockReview]);
      // Non-completed reviews would simply not be returned by the hardened query

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByProfessional(10);

      // Assert: only the completed review is returned
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].id).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should enforce completion gating at Prisma level (hardened domain rule)', async () => {
      // Arrange: verify the Prisma query includes completion filter AND proposal→professional chain
      mockPrisma.professional.findUnique.mockResolvedValue(mockProfessional);
      mockPrisma.review.findMany.mockResolvedValue([]);

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      await reviewService.getReviewsByProfessional(10);

      // Assert: verify the call was made with correct Prisma WHERE clause
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewedUserId: mockProfessional.userId,
            appointment: {
              proposal: {
                professionalId: 10,
              },
              status: 'completed',
              completedAt: { not: null },
            },
          }),
        })
      );
    });

    it('should return empty array when professional has no reviews', async () => {
      // Arrange
      mockPrisma.professional.findUnique.mockResolvedValue(mockProfessional);
      mockPrisma.review.findMany.mockResolvedValue([]);

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByProfessional(10);

      // Assert
      expect(result.professionalId).toBe(10);
      expect(result.reviews).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw 404 when professional does not exist', async () => {
      // Arrange
      mockPrisma.professional.findUnique.mockResolvedValue(null);

      const { reviewService } = require('../../../src/services/review.service');

      // Act & Assert
      await expect(reviewService.getReviewsByProfessional(999)).rejects.toMatchObject({
        message: 'Professional not found',
        statusCode: 404,
      });
    });

    it('should map null profile photo correctly', async () => {
      // Arrange
      mockPrisma.professional.findUnique.mockResolvedValue(mockProfessional);
      mockPrisma.review.findMany.mockResolvedValue([
        {
          ...mockReview,
          reviewer: { ...mockReview.reviewer, profilePhotoUrl: null },
        },
      ]);

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByProfessional(10);

      // Assert
      expect(result.reviews[0].reviewerProfilePhotoUrl).toBeNull();
    });

    it('should handle null comment', async () => {
      // Arrange
      mockPrisma.professional.findUnique.mockResolvedValue(mockProfessional);
      mockPrisma.review.findMany.mockResolvedValue([
        {
          ...mockReview,
          comment: null,
        },
      ]);

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByProfessional(10);

      // Assert
      expect(result.reviews[0].comment).toBeNull();
    });
  });

  describe('getReviewsByUser', () => {
    const mockUser = {
      id: 2,
      fullName: 'María García',
      email: 'maria@example.com',
    };

    const mockReviewer = {
      id: 2,
      fullName: 'María García',
      profilePhotoUrl: null,
    };

    const mockCompletedAppointment = {
      id: 100,
      status: 'completed',
      completedAt: new Date('2024-01-15'),
    };

    const mockReview = {
      id: 1,
      appointmentId: 100,
      reviewerUserId: 2,
      reviewedUserId: 1,
      rating: 4,
      comment: 'Buen servicio',
      createdAt: new Date('2024-01-16'),
      reviewer: mockReviewer,
      appointment: mockCompletedAppointment,
    };

    it('should return reviews written by a user', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.review.findMany.mockResolvedValue([mockReview]);

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByUser(2);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        reviewerUserId: 2,
        reviewerFullName: 'María García',
        rating: 4,
        comment: 'Buen servicio',
      });
    });

    it('should return empty array when user has not written any reviews', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.review.findMany.mockResolvedValue([]);

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByUser(2);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should throw 404 when user does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const { reviewService } = require('../../../src/services/review.service');

      // Act & Assert
      await expect(reviewService.getReviewsByUser(999)).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('should filter out reviews from non-completed appointments', async () => {
      // Arrange: Prisma now handles completion gating at query level
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.review.findMany.mockResolvedValue([mockReview]);
      // Non-completed reviews are filtered by Prisma, not in-memory

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      const result = await reviewService.getReviewsByUser(2);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should enforce completion gating at Prisma level for user reviews', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.review.findMany.mockResolvedValue([]);

      const { reviewService } = require('../../../src/services/review.service');

      // Act
      await reviewService.getReviewsByUser(2);

      // Assert: verify Prisma query includes completion filter
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewerUserId: mockUser.id,
            appointment: {
              status: 'completed',
              completedAt: { not: null },
            },
          }),
        })
      );
    });
  });
});
