import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.types';

export const requireClientRole = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required'));
  }

  if (req.user.role !== 'client') {
    return next(new AppError(403, 'Only clients can access this endpoint'));
  }

  next();
};
