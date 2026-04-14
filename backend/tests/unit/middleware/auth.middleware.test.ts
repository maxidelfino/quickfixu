// tests/unit/middleware/auth.middleware.test.ts
// Unit tests for requireAuth and isProfessional middleware

import { Request, Response, NextFunction } from 'express';
import { requireAuth, isProfessional } from '../../../src/middleware/auth.middleware';
import { verifyToken, signToken } from '../../../src/config/jwt';
import prisma from '../../../src/config/database';
import { AppError } from '../../../src/types/errors.types';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper: create a mock Express Request
function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  } as Request;
}

// Helper: create a mock Express Response
function mockResponse(): Response {
  return {} as Response;
}

// Helper: create a jest.fn() next
function mockNext(): NextFunction {
  return jest.fn() as NextFunction;
}

describe('requireAuth middleware', () => {
  it('should attach user to req.user for a valid JWT', async () => {
    const token = signToken(1);
    const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = mockResponse();
    const next = mockNext();

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      isActive: true,
      professional: null,
    });

    await requireAuth(req, res, next);

    expect(req.user).toEqual({ id: 1, email: 'test@example.com', role: 'client' });
    expect(next).toHaveBeenCalledWith(); // called with no error
  });

  it('should call next(AppError 401) when Authorization header is missing', async () => {
    const req = mockRequest({ headers: {} });
    const res = mockResponse();
    const next = mockNext();

    await requireAuth(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('should call next(AppError 401) when header does not start with "Bearer "', async () => {
    const req = mockRequest({ headers: { authorization: 'Token abc123' } });
    const res = mockResponse();
    const next = mockNext();

    await requireAuth(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('should call next(AppError 401) for an invalid JWT', async () => {
    const req = mockRequest({ headers: { authorization: 'Bearer invalid.jwt.token' } });
    const res = mockResponse();
    const next = mockNext();

    // Mock verifyToken to simulate invalid token
    (verifyToken as jest.Mock).mockImplementationOnce(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    await requireAuth(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('should call next(AppError 401) for an expired JWT', async () => {
    const req = mockRequest({ headers: { authorization: 'Bearer expired.jwt.token' } });
    const res = mockResponse();
    const next = mockNext();

    // Mock verifyToken to simulate expired token
    (verifyToken as jest.Mock).mockImplementationOnce(() => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    await requireAuth(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Token expired');
  });

  it('should attach role "professional" when user has a professional record', async () => {
    const token = signToken(2);
    const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = mockResponse();
    const next = mockNext();

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 2,
      email: 'pro@example.com',
      isActive: true,
      professional: { id: 10 },
    });

    await requireAuth(req, res, next);

    expect(req.user?.role).toBe('professional');
    expect(next).toHaveBeenCalledWith();
  });
});

describe('isProfessional middleware', () => {
  it('should call next() when user has professional role', () => {
    const req = mockRequest({ user: { id: 1, email: 'pro@example.com', role: 'professional' } } as any);
    const res = mockResponse();
    const next = mockNext();

    isProfessional(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next(AppError 403) when user has client role', () => {
    const req = mockRequest({ user: { id: 1, email: 'client@example.com', role: 'client' } } as any);
    const res = mockResponse();
    const next = mockNext();

    isProfessional(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it('should call next(AppError 401) when req.user is not set', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    isProfessional(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });
});
