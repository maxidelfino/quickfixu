// src/middleware/auth.middleware.ts
// Authentication and authorization middleware

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import prisma from '../config/database';
import { AppError } from '../types/errors.types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: 'client' | 'professional';
      };
    }
  }
}

/**
 * Require valid JWT authentication
 * Extracts JWT from Authorization header, verifies it, and attaches user to req.user
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication required');
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    // Fetch user to check if active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { professional: true },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'User not found or inactive');
    }

    // Attach user to request with role derived from professional record
    req.user = {
      id: user.id,
      email: user.email,
      role: user.professional ? 'professional' : 'client',
    };

    next();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      // Send AppError as-is (it will be handled by error middleware)
      return next(error);
    }

    if (error && typeof error === 'object' && 'name' in error) {
      const err = error as { name: string };
      if (err.name === 'TokenExpiredError') {
        return next(new AppError(401, 'Token expired'));
      }
      if (err.name === 'JsonWebTokenError') {
        return next(new AppError(401, 'Invalid token'));
      }
    }

    next(error);
  }
};

/**
 * Require professional role
 * Must be used after requireAuth middleware
 */
export const isProfessional = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required'));
  }

  if (req.user.role !== 'professional') {
    return next(
      new AppError(403, 'Only professionals can access this endpoint')
    );
  }

  next();
};
