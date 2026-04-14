// src/controllers/auth.controller.ts
// Auth controller - HTTP handlers for /api/auth/* routes

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { RegisterDto, LoginDto, OAuthGoogleDto, OAuthFacebookDto, RefreshTokenDto } from '../types/auth.types';

class AuthController {
  /**
   * POST /api/auth/register
   * Register new user (client or professional)
   * Body: { fullName, email, password, phone, dni, address, yearsExperience?, description?, categoryIds? }
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as RegisterDto;
      const result = await authService.register(data);
      
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Login with email/password
   * Body: { email, password }
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as LoginDto;
      const result = await authService.login(email, password);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/google
   * OAuth Google sign-in
   * Body: { idToken }
   */
  async oauthGoogle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as OAuthGoogleDto;
      const result = await authService.oauthGoogle(data);
      
      // Return 201 if new user, 200 if existing
      // We can detect this by checking if it's a new creation, but for simplicity return 200
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/facebook
   * OAuth Facebook sign-in
   * Body: { accessToken }
   */
  async oauthFacebook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as OAuthFacebookDto;
      const result = await authService.oauthFacebook(data);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh access token
   * Body: { refreshToken }
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenDto;
      const result = await authService.refreshAccessToken(refreshToken);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Revoke refresh token
   * Body: { refreshToken }
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenDto;
      await authService.logout(refreshToken);
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
