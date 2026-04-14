// src/middleware/multer.middleware.ts
// File upload middleware (Multer configuration)

import multer from 'multer';
import { UPLOAD_CONSTANTS } from '../config/constants';
import { AppError } from '../types/errors.types';

// ============================================================
// MEMORY STORAGE (for processing with sharp before upload)
// ============================================================

const memoryStorage = multer.memoryStorage();

// ============================================================
// FILE FILTER - Validate file types
// ============================================================

const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedTypes = UPLOAD_CONSTANTS.ALLOWED_IMAGE_TYPES as readonly string[];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        `Invalid file type. Allowed types: ${UPLOAD_CONSTANTS.ALLOWED_IMAGE_TYPES.join(', ')}`
      )
    );
  }
};

const certificationFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedTypes = UPLOAD_CONSTANTS.ALLOWED_DOC_TYPES as readonly string[];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        `Invalid file type. Allowed types: ${UPLOAD_CONSTANTS.ALLOWED_DOC_TYPES.join(', ')}`
      )
    );
  }
};

// ============================================================
// ERROR HANDLER - Custom multer error handler
// ============================================================

export const handleMulterError = (
  err: Error | AppError,
  _req: Express.Request,
  _res: Express.Response,
  next: (error?: Error | AppError) => void
): void => {
  if (err instanceof AppError) {
    return next(err);
  }

  // Handle multer-specific errors
  if (err.message?.includes('File too large')) {
    return next(new AppError(413, 'File too large'));
  }

  if (err.message?.includes('Unexpected field')) {
    return next(new AppError(400, 'Unexpected field'));
  }

  next(err);
};

// ============================================================
// MULTER CONFIGURATIONS
// ============================================================

/**
 * Multer configuration for profile photo uploads
 * - Memory storage (buffer) - processed with sharp before Cloudinary upload
 * - Max size: 5MB
 * - Allowed types: JPEG, PNG, WEBP
 */
export const uploadProfilePhoto = multer({
  storage: memoryStorage,
  limits: {
    fileSize: UPLOAD_CONSTANTS.PROFILE_PHOTO_MAX_SIZE,
  },
  fileFilter: imageFileFilter,
}).single('photo');

/**
 * Multer configuration for certification documents
 * - Memory storage (buffer)
 * - Max size: 10MB
 * - Allowed types: PDF, JPEG, PNG
 */
export const uploadCertification = multer({
  storage: memoryStorage,
  limits: {
    fileSize: UPLOAD_CONSTANTS.CERTIFICATION_MAX_SIZE,
  },
  fileFilter: certificationFileFilter,
}).single('certification');

/**
 * Multer configuration for multiple certification uploads
 */
export const uploadCertifications = multer({
  storage: memoryStorage,
  limits: {
    fileSize: UPLOAD_CONSTANTS.CERTIFICATION_MAX_SIZE,
    files: 5, // Maximum 5 certification files at once
  },
  fileFilter: certificationFileFilter,
}).array('certifications', 5);
