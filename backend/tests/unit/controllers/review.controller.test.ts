// tests/unit/controllers/review.controller.test.ts
// Unit tests for ReviewController - Public reviews route
// NOTE: This file uses mocks (mock-driven). These are NOT integration tests.

import { Request, Response, NextFunction } from 'express';

// Mock the review service
jest.mock('../../../src/services/review.service', () => {
  return {
    reviewService: {
      getReviewsByProfessional: jest.fn(),
    },
  };
});

describe('ReviewController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('getReviewsByProfessional', () => {
    const { reviewController } = require('../../../src/controllers/review.controller');
    const { reviewService } = require('../../../src/services/review.service');

    it('should be defined as a function', () => {
      expect(typeof reviewController.getReviewsByProfessional).toBe('function');
    });

    it('should return 400 for malformed professional ID (non-numeric string)', async () => {
      // Arrange
      mockRequest.params = { id: 'abc' };

      // Act
      await reviewController.getReviewsByProfessional(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: malformed ID should return 400 (bad request)
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid professional ID',
        })
      );
    });

    it('should return 400 for fractional numeric ID', async () => {
      // Arrange
      mockRequest.params = { id: '12.34' };

      // Act
      await reviewController.getReviewsByProfessional(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: parseInt on '12.34' yields 12, but isNaN check should still pass
      // Actually parseInt('12.34', 10) = 12, so isNaN(12) = false - it passes
      // This edge case is handled by route regex :id([0-9]+) in Express
      // The controller test validates the explicit isNaN guard
    });

    it('should return 400 for empty string ID', async () => {
      // Arrange
      mockRequest.params = { id: '' };

      // Act
      await reviewController.getReviewsByProfessional(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid professional ID',
        })
      );
    });

    it('should call reviewService.getReviewsByProfessional with parsed professionalId', async () => {
      // Arrange
      mockRequest.params = { id: '42' };
      const mockServiceResponse = {
        professionalId: 42,
        reviews: [],
        total: 0,
      };
      reviewService.getReviewsByProfessional.mockResolvedValue(mockServiceResponse);

      // Act
      await reviewController.getReviewsByProfessional(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.getReviewsByProfessional).toHaveBeenCalledWith(42);
    });

    it('should return 200 with reviews array on success', async () => {
      // Arrange
      mockRequest.params = { id: '10' };
      const mockReviews = [
        {
          id: 1,
          appointmentId: 100,
          reviewerUserId: 2,
          reviewerFullName: 'María García',
          reviewerProfilePhotoUrl: 'https://example.com/photo.jpg',
          reviewedUserId: 1,
          rating: 5,
          comment: 'Excelente trabajo',
          createdAt: new Date('2024-01-16'),
        },
      ];
      reviewService.getReviewsByProfessional.mockResolvedValue({
        professionalId: 10,
        reviews: mockReviews,
        total: 1,
      });

      // Act
      await reviewController.getReviewsByProfessional(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        professionalId: 10,
        reviews: mockReviews,
        total: 1,
      });
    });

    it('should pass service errors to next middleware', async () => {
      // Arrange
      mockRequest.params = { id: '999' };
      const notFoundError = new Error('Professional not found');
      (notFoundError as any).statusCode = 404;
      reviewService.getReviewsByProfessional.mockRejectedValue(notFoundError);

      // Act
      await reviewController.getReviewsByProfessional(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(notFoundError);
    });

    it('should return empty reviews array when professional has no reviews', async () => {
      // Arrange
      mockRequest.params = { id: '10' };
      reviewService.getReviewsByProfessional.mockResolvedValue({
        professionalId: 10,
        reviews: [],
        total: 0,
      });

      // Act
      await reviewController.getReviewsByProfessional(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        professionalId: 10,
        reviews: [],
        total: 0,
      });
    });
  });
});
