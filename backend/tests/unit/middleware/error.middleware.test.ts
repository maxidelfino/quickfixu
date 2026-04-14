// tests/unit/middleware/error.middleware.test.ts
// Unit tests for global error handler middleware

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { errorMiddleware } from '../../../src/middleware/error.middleware';
import { AppError, ValidationError } from '../../../src/types/errors.types';

// Helper: create mock Request
function mockRequest(): Request {
  return {} as Request;
}

// Helper: create mock Response with json spy
function mockResponse(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Helper: create mock next
function mockNext(): NextFunction {
  return jest.fn() as NextFunction;
}

describe('errorMiddleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  describe('AppError handling', () => {
    it('should return correct status code and message for AppError', () => {
      const error = new AppError(404, 'Resource not found');

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Resource not found' });
    });

    it('should handle 401 unauthorized errors', () => {
      const error = new AppError(401, 'Unauthorized access');

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized access' });
    });

    it('should handle 500 internal server errors', () => {
      const error = new AppError(500, 'Something went wrong');

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
    });
  });

  describe('ValidationError handling', () => {
    it('should return 400 with details for ValidationError', () => {
      const details = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ];
      const error = new ValidationError(details);

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: details,
      });
    });
  });

  describe('Prisma error handling', () => {
    it('should handle P2002 unique constraint violation (409)', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.9.1',
        meta: { target: ['email'] },
      });

      errorMiddleware(error as any, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'email already exists' });
    });

    it('should handle P2025 record not found (404)', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: '5.9.1',
      });

      errorMiddleware(error as any, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Record not found' });
    });

    it('should handle P2003 foreign key constraint (400)', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.9.1',
      });

      errorMiddleware(error as any, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid reference (foreign key constraint)',
      });
    });
  });

  describe('JWT error handling', () => {
    it('should handle JsonWebTokenError (401)', () => {
      const error = new Error('invalid signature');
      error.name = 'JsonWebTokenError';

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should handle TokenExpiredError (401)', () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });
  });

  describe('Multer error handling', () => {
    it('should handle "File too large" MulterError (400)', () => {
      const error = new Error('File too large');
      error.name = 'MulterError';

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'File size exceeds limit' });
    });

    it('should handle generic MulterError (400)', () => {
      const error = new Error('Unexpected field');
      error.name = 'MulterError';

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'File upload error' });
    });
  });

  describe('Unknown error handling', () => {
    it('should return 500 with error message in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Something unexpected happened');

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something unexpected happened' });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should return generic 500 message in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Secret internal error');

      errorMiddleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});
