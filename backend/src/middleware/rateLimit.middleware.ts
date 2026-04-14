// src/middleware/rateLimit.middleware.ts
// Rate limiting middleware to prevent abuse

import rateLimit from 'express-rate-limit';
import { AUTH_CONSTANTS } from '../config/constants';

/**
 * Global rate limiter (100 requests per 15 minutes)
 * Applied to all routes
 */
export const globalRateLimiter = rateLimit({
  windowMs: AUTH_CONSTANTS.GLOBAL_RATE_LIMIT_WINDOW_MS,
  max: AUTH_CONSTANTS.GLOBAL_RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

/**
 * Auth-specific rate limiter (10 attempts per 15 minutes)
 * Applied to /api/auth/* routes (login, register)
 * Counts only failed requests
 */
export const authRateLimiter = rateLimit({
  windowMs: AUTH_CONSTANTS.AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_CONSTANTS.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  skipSuccessfulRequests: true, // Only count failed auth attempts
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
