// src/middleware/error.middleware.ts
// Global error handler - catches all errors and sends structured responses

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../types/errors.types';

/**
 * Global error handler middleware
 * MUST be registered LAST in app.ts (after all routes)
 */
export const errorMiddleware: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('🔥 Error caught by global handler:', err);

  // Prisma database errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation (e.g., duplicate email)
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.[0] || 'Field';
      res.status(409).json({
        error: `${field} already exists`,
      });
      return;
    }

    // Record not found
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    // Foreign key constraint violation
    if (err.code === 'P2003') {
      res.status(400).json({ error: 'Invalid reference (foreign key constraint)' });
      return;
    }
  }

  // Validation error (Zod)
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  // Application errors (custom AppError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Token expired' });
    return;
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.message === 'File too large') {
      res.status(400).json({ error: 'File size exceeds limit' });
      return;
    }
    res.status(400).json({ error: 'File upload error' });
    return;
  }

  // Unknown errors (500 Internal Server Error)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
};
