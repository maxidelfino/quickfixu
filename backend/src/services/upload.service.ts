// src/services/upload.service.ts
// Upload service - Cloudinary integration for images and documents

import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { UPLOAD_CONSTANTS } from '../config/constants';
import { AppError } from '../types/errors.types';

class UploadService {
  private ensureCloudinaryConfigured(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const isConfigured = Boolean(cloudName && apiKey && apiSecret);

    if (isConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }

    return isConfigured;
  }

  private isMockCloudinaryAllowed(): boolean {
    return (
      (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') &&
      process.env.ALLOW_MOCK_CLOUDINARY === 'true'
    );
  }

  private ensureCloudinaryAvailable(): void {
    if (this.ensureCloudinaryConfigured() || this.isMockCloudinaryAllowed()) {
      return;
    }

    throw new AppError(
      500,
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET or enable ALLOW_MOCK_CLOUDINARY=true in development/test.'
    );
  }

  /**
   * Upload profile photo to Cloudinary
   * - Resize to 800x800 with sharp
   * - Compress to JPEG quality 80%
   * - Upload to Cloudinary folder: quickfixu/profiles/{userId}
   */
  async uploadProfilePhoto(file: Express.Multer.File, userId: number): Promise<string> {
    this.ensureCloudinaryAvailable();

    if (!this.ensureCloudinaryConfigured()) {
      console.warn('⚠️  Cloudinary not configured. Returning gated mock profile photo URL.');
      return this.getMockPhotoUrl(userId);
    }

    try {
      // Resize and compress image with sharp
      const processedBuffer = await sharp(file.buffer)
        .resize(
          UPLOAD_CONSTANTS.PROFILE_PHOTO_DIMENSIONS.width,
          UPLOAD_CONSTANTS.PROFILE_PHOTO_DIMENSIONS.height,
          {
            fit: 'cover',
            position: 'center',
          }
        )
        .jpeg({ quality: UPLOAD_CONSTANTS.PROFILE_PHOTO_QUALITY })
        .toBuffer();

      // Upload to Cloudinary
      const result = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `quickfixu/profiles/${userId}`,
              public_id: 'photo',
              resource_type: 'image',
              transformation: [
                {
                  width: UPLOAD_CONSTANTS.PROFILE_PHOTO_DIMENSIONS.width,
                  height: UPLOAD_CONSTANTS.PROFILE_PHOTO_DIMENSIONS.height,
                  crop: 'fill',
                  quality: 'auto',
                  fetch_format: 'auto',
                },
              ],
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else if (result) {
                resolve(result as { secure_url: string; public_id: string });
              } else {
                reject(new Error('No result from Cloudinary'));
              }
            }
          );

          uploadStream.end(processedBuffer);
        }
      );

      return result.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new AppError(500, 'Failed to upload profile photo');
    }
  }

  /**
   * Upload certification document (PDF or image)
   * - Validate file type (PDF, JPEG, PNG)
   * - Upload to Cloudinary folder: quickfixu/certifications/{professionalId}
   */
  async uploadCertification(file: Express.Multer.File, professionalId: number): Promise<string> {
    this.ensureCloudinaryAvailable();

    if (!this.ensureCloudinaryConfigured()) {
      console.warn('⚠️  Cloudinary not configured. Returning gated mock certification URL.');
      return this.getMockCertificationUrl(professionalId);
    }

    try {
      let uploadBuffer: Buffer;
      let resourceType: 'image' | 'raw' = 'image';

      // Process image files
      if (file.mimetype.startsWith('image/')) {
        // Compress image but don't resize (certifications may need full resolution)
        uploadBuffer = await sharp(file.buffer)
          .jpeg({ quality: 85 })
          .toBuffer();
      } else if (file.mimetype === 'application/pdf') {
        uploadBuffer = file.buffer;
        resourceType = 'raw';
      } else {
        throw new AppError(400, 'Invalid certification file type. Supported: PDF, JPEG, PNG');
      }

      // Upload to Cloudinary
      const result = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `quickfixu/certifications/${professionalId}`,
              resource_type: resourceType,
              transformation: resourceType === 'image' ? [
                {
                  quality: 'auto',
                  fetch_format: 'auto',
                },
              ] : undefined,
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else if (result) {
                resolve(result as { secure_url: string; public_id: string });
              } else {
                reject(new Error('No result from Cloudinary'));
              }
            }
          );

          uploadStream.end(uploadBuffer);
        }
      );

      return result.secure_url;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Cloudinary certification upload error:', error);
      throw new AppError(500, 'Failed to upload certification');
    }
  }

  /**
   * Delete file from Cloudinary
   * - Extract public_id from URL
   * - Call cloudinary.uploader.destroy()
   * - Don't throw error if file doesn't exist (idempotent)
   */
  async deleteFile(url: string): Promise<void> {
    this.ensureCloudinaryAvailable();

    if (!this.ensureCloudinaryConfigured()) {
      console.warn('⚠️  Cloudinary not configured. Skipping deletion under gated mock mode.');
      return;
    }

    try {
      // Extract public_id from URL
      const publicId = this.extractPublicId(url);
      const resourceType = this.extractResourceType(url);

      if (!publicId || !resourceType) {
        console.warn('Could not extract public_id from URL:', url);
        return;
      }

      // Delete from Cloudinary
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      // Don't throw if file doesn't exist (idempotent)
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('not found') || errorMessage.includes('resource not found')) {
        console.warn('File not found in Cloudinary, skipping deletion');
        return;
      }

      console.error('Cloudinary delete error:', error);
      // Don't throw - deletion failure shouldn't block operations
    }
  }

  /**
   * Extract public_id from Cloudinary URL
   */
  private extractPublicId(url: string): string | null {
    try {
      // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{folder}/{public_id}.{extension}
      // Or: https://res.cloudinary.com/{cloud_name}/raw/upload/{version}/{folder}/{public_id}

      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // Find 'upload' position and get everything after it
      const uploadIndex = pathParts.indexOf('upload');
      if (uploadIndex === -1) {
        return null;
      }

      // Skip 'upload' and any version folder (starts with v)
      const partsAfterUpload = pathParts.slice(uploadIndex + 1).filter((part) => !part.startsWith('v'));

      if (partsAfterUpload.length === 0) {
        return null;
      }

      // Remove file extension
      const publicId = partsAfterUpload.join('/').replace(/\.[^/.]+$/, '');

      return publicId;
    } catch (error) {
      console.error('Failed to extract public_id:', error);
      return null;
    }
  }

  private extractResourceType(url: string): 'image' | 'raw' | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const uploadIndex = pathParts.indexOf('upload');

      if (uploadIndex <= 0) {
        return null;
      }

      const resourceType = pathParts[uploadIndex - 1];

      if (resourceType === 'image' || resourceType === 'raw') {
        return resourceType;
      }

      return null;
    } catch (error) {
      console.error('Failed to extract resource_type:', error);
      return null;
    }
  }

  /**
   * Generate mock URL when explicitly enabled for development/test
   */
  private getMockPhotoUrl(userId: number): string {
    const timestamp = Date.now();
    return `https://via.placeholder.com/800x800.png?text=User+${userId}&timestamp=${timestamp}`;
  }

  /**
   * Generate mock certification URL when explicitly enabled for development/test
   */
  private getMockCertificationUrl(professionalId: number): string {
    const timestamp = Date.now();
    return `https://via.placeholder.com/800x1000.png?text=Certification+${professionalId}&timestamp=${timestamp}`;
  }
}

export const uploadService = new UploadService();
