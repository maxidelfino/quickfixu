// src/controllers/user.controller.ts
// User controller - HTTP handlers for /api/users/* routes

import { Request, Response, NextFunction } from 'express';
import { userService, UpdateProfileDto, UpdateProfessionalDto } from '../services/user.service';
import { AppError } from '../types/errors.types';

class UserController {
  /**
   * GET /api/users/me
   * Get authenticated user's profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const user = await userService.getProfile(userId);

      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/me
   * Update authenticated user's profile
   * Body: { fullName?, phone?, address?, yearsExperience?, description?, categoryIds? }
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const body = req.body;

      // Separate user fields from professional fields
      const userData: UpdateProfileDto = {};
      const professionalData: UpdateProfessionalDto = {};

      // User fields
      if (body.fullName !== undefined) {
        userData.fullName = body.fullName;
      }
      if (body.phone !== undefined) {
        userData.phone = body.phone;
      }
      if (body.address !== undefined) {
        userData.address = body.address;
      }

      // Professional fields
      if (body.yearsExperience !== undefined) {
        professionalData.yearsExperience = parseInt(body.yearsExperience, 10);
      }
      if (body.description !== undefined) {
        professionalData.description = body.description;
      }
      if (body.categoryIds !== undefined) {
        professionalData.categoryIds = Array.isArray(body.categoryIds)
          ? body.categoryIds.map((id: string | number) => parseInt(String(id), 10)).filter((id: number) => !isNaN(id))
          : undefined;
      }

      // Update user profile
      let updatedUser = await userService.updateProfile(userId, userData);

      // Update professional details if any professional fields provided
      if (Object.keys(professionalData).length > 0) {
        updatedUser = await userService.updateProfessionalDetails(userId, professionalData);
      }

      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users/me/photo
   * Upload profile photo
   * Content-Type: multipart/form-data
   * Field: 'photo' (required)
   */
  async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // Check if file was uploaded by multer
      if (!req.file) {
        throw new AppError(400, 'No photo file provided. Please upload a file with field name "photo".');
      }

      const photoUrl = await userService.uploadPhoto(userId, req.file);

      res.status(200).json({
        profilePhotoUrl: photoUrl,
        message: 'Profile photo uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/users/me
   * Delete authenticated user's account
   */
  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      await userService.deleteAccount(userId);

      // Note: In a real app, you might want to revoke all tokens here
      // For now, the client should clear tokens on their end

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
