// src/services/user.service.ts
// User service - CRUD operations for user profiles

import prisma from '../config/database';
import { AppError } from '../types/errors.types';
import { geocodingService } from './geocoding.service';
import { uploadService } from './upload.service';
import {
  UserResponse,
  CategoryResponse,
  CertificationResponse,
} from '../types/auth.types';

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  address?: string;
}

export interface UpdateProfessionalDto {
  yearsExperience?: number;
  description?: string;
  categoryIds?: number[];
}

class UserService {
  /**
   * Get user profile by ID with professional data
   */
  async getProfile(userId: number): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        professional: {
          include: {
            categories: {
              include: {
                category: true,
              },
            },
            certifications: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return this.formatUserResponse(user);
  }

  /**
   * Update user profile (basic fields)
   * If address changes, re-geocode
   */
  async updateProfile(
    userId: number,
    data: UpdateProfileDto
  ): Promise<UserResponse> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new AppError(404, 'User not found');
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (data.fullName !== undefined) {
      updateData.fullName = data.fullName;
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }

    // Handle address change - re-geocode if address provided
    if (data.address !== undefined && data.address !== existingUser.address) {
      try {
        const { latitude, longitude } = await geocodingService.geocode(data.address);
        updateData.address = data.address;
        updateData.latitude = latitude;
        updateData.longitude = longitude;
      } catch (error) {
        // If geocoding fails, still update address but keep old coordinates
        console.warn('Geocoding failed, keeping old coordinates:', error);
        updateData.address = data.address;
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        professional: {
          include: {
            categories: {
              include: {
                category: true,
              },
            },
            certifications: true,
          },
        },
      },
    });

    return this.formatUserResponse(updatedUser);
  }

  /**
   * Update professional details
   */
  async updateProfessionalDetails(
    userId: number,
    data: UpdateProfessionalDto
  ): Promise<UserResponse> {
    // Get professional record
    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    // Update professional fields
    const updateData: Record<string, unknown> = {};

    if (data.yearsExperience !== undefined) {
      updateData.yearsExperience = data.yearsExperience;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    // Update categories if provided
    if (data.categoryIds !== undefined) {
      // Delete existing categories
      await prisma.professionalCategory.deleteMany({
        where: { professionalId: professional.id },
      });

      // Create new category links
      if (data.categoryIds.length > 0) {
        await prisma.professionalCategory.createMany({
          data: data.categoryIds.map((categoryId) => ({
            professionalId: professional.id,
            categoryId,
          })),
        });
      }
    }

    // Update professional if there are fields to update
    if (Object.keys(updateData).length > 0) {
      await prisma.professional.update({
        where: { id: professional.id },
        data: updateData,
      });
    }

    // Return updated user
    return this.getProfile(userId);
  }

  /**
   * Upload profile photo
   */
  async uploadPhoto(userId: number, file: Express.Multer.File): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Delete old photo if exists
    if (user.profilePhotoUrl) {
      try {
        await uploadService.deleteFile(user.profilePhotoUrl);
      } catch (error) {
        console.warn('Failed to delete old profile photo:', error);
      }
    }

    // Upload new photo
    const newPhotoUrl = await uploadService.uploadProfilePhoto(file, userId);

    // Update user with new photo URL
    await prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl: newPhotoUrl },
    });

    return newPhotoUrl;
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteAccount(userId: number): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Soft delete: set isActive = false
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Revoke all refresh tokens (cascade will handle this with onDelete)
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Format user response from database model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatUserResponse(user: any) {
    if (!user) {
      throw new AppError(500, 'Internal server error');
    }

    const role: 'client' | 'professional' = user.professional ? 'professional' : 'client';

    const userResponse: UserResponse = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      dni: user.dni,
      address: user.address,
      latitude: Number(user.latitude),
      longitude: Number(user.longitude),
      profilePhotoUrl: user.profilePhotoUrl || undefined,
      rating: Number(user.rating),
      ratingCount: user.ratingCount,
      role,
      createdAt: user.createdAt,
    };

    if (user.professional) {
      const categories: CategoryResponse[] = user.professional.categories.map(
        (pc: { category: { id: number; name: string; slug: string; icon: string } }) => ({
          id: pc.category.id,
          name: pc.category.name,
          slug: pc.category.slug,
          icon: pc.category.icon,
        })
      );

      const certifications: CertificationResponse[] = user.professional.certifications.map(
        (cert: { id: number; fileUrl: string; status: string; uploadedAt: Date }) => ({
          id: cert.id,
          fileUrl: cert.fileUrl,
          status: cert.status as 'pending' | 'approved' | 'rejected',
          uploadedAt: cert.uploadedAt,
        })
      );

      userResponse.professional = {
        id: user.professional.id,
        yearsExperience: user.professional.yearsExperience,
        description: user.professional.description,
        categories,
        certifications,
      };
    }

    return userResponse;
  }
}

export const userService = new UserService();
