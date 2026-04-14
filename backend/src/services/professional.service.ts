// src/services/professional.service.ts
// Professional service - Profile management, search, and certifications

import prisma from '../config/database';
import { AppError } from '../types/errors.types';
import { uploadService } from './upload.service';
import {
  CategoryResponse,
  CertificationResponse,
} from '../types/auth.types';

// ============================================================
// DTOs
// ============================================================

export interface UpdateProfessionalProfileDto {
  description?: string;
  yearsExperience?: number;
}

export interface ProfessionalProfileResponse {
  id: number;
  userId: number;
  description: string;
  yearsExperience: number;
  categories: CategoryResponse[];
  certifications: CertificationResponse[];
  user: {
    id: number;
    fullName: string;
    email: string;
    phone: string;
    address: string;
    profilePhotoUrl?: string;
    rating: number;
    ratingCount: number;
  };
}

export interface PublicProfessionalResponse {
  id: number;
  userId: number;
  description: string;
  yearsExperience: number;
  categories: CategoryResponse[];
  certifications: CertificationResponse[]; // Only approved
  user: {
    id: number;
    fullName: string;
    address: string;
    profilePhotoUrl?: string;
    rating: number;
    ratingCount: number;
  };
}

export interface SearchResult {
  id: number;
  userId: number;
  description: string;
  yearsExperience: number;
  categories: CategoryResponse[];
  distanceKm: number;
  user: {
    id: number;
    fullName: string;
    address: string;
    profilePhotoUrl?: string;
    rating: number;
    ratingCount: number;
  };
}

// ============================================================
// SERVICE
// ============================================================

class ProfessionalService {
  /**
   * Get own professional profile (with all certifications)
   */
  async getProfessionalProfile(userId: number): Promise<ProfessionalProfileResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const professional = await (prisma.professional as any).findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            address: true,
            profilePhotoUrl: true,
            rating: true,
            ratingCount: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        certifications: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    return this.formatProfessionalProfile(professional);
  }

  /**
   * Update professional description and years of experience
   */
  async updateProfessionalProfile(
    userId: number,
    data: UpdateProfessionalProfileDto
  ): Promise<ProfessionalProfileResponse> {
    // Get professional record
    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    // Validate description
    if (data.description !== undefined) {
      if (data.description.length < 10 || data.description.length > 500) {
        throw new AppError(400, 'Description must be between 10 and 500 characters');
      }
    }

    // Validate yearsExperience
    if (data.yearsExperience !== undefined) {
      if (!Number.isInteger(data.yearsExperience) || data.yearsExperience < 0) {
        throw new AppError(400, 'yearsExperience must be a non-negative integer');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.yearsExperience !== undefined) updateData.yearsExperience = data.yearsExperience;

    if (Object.keys(updateData).length > 0) {
      await prisma.professional.update({
        where: { id: professional.id },
        data: updateData,
      });
    }

    return this.getProfessionalProfile(userId);
  }

  /**
   * Replace professional categories (1-3 max)
   */
  async updateCategories(userId: number, categoryIds: number[]): Promise<ProfessionalProfileResponse> {
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new AppError(400, 'At least one category is required');
    }

    if (categoryIds.length > 3) {
      throw new AppError(400, 'Maximum 3 categories allowed');
    }

    // Validate that all category IDs exist
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });

    if (categories.length !== categoryIds.length) {
      throw new AppError(400, 'One or more category IDs are invalid');
    }

    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    // Replace categories atomically
    await prisma.$transaction([
      prisma.professionalCategory.deleteMany({
        where: { professionalId: professional.id },
      }),
      prisma.professionalCategory.createMany({
        data: categoryIds.map((categoryId) => ({
          professionalId: professional.id,
          categoryId,
        })),
      }),
    ]);

    return this.getProfessionalProfile(userId);
  }

  /**
   * Get public professional profile (only approved certifications)
   */
  async getPublicProfile(professionalId: number): Promise<PublicProfessionalResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const professional = await (prisma.professional as any).findUnique({
      where: { id: professionalId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            address: true,
            profilePhotoUrl: true,
            rating: true,
            ratingCount: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        certifications: {
          where: {
            status: 'approved',
            deletedAt: null,
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!professional) {
      throw new AppError(404, 'Professional not found');
    }

    return this.formatPublicProfile(professional);
  }

  /**
   * Search professionals by location using PostGIS ST_DWithin
   */
  async searchByLocation(
    lat: number,
    lng: number,
    radiusKm: number,
    categoryId?: number
  ): Promise<SearchResult[]> {
    const radiusMeters = radiusKm * 1000;

    // Build raw SQL for PostGIS spatial search
    // ST_DWithin is faster than ST_Distance for radius queries (uses spatial index)
    const results = await prisma.$queryRaw<
      Array<{
        id: number;
        user_id: number;
        description: string;
        years_experience: number;
        distance_m: number;
        full_name: string;
        address: string;
        profile_photo_url: string | null;
        rating: string;
        rating_count: number;
      }>
    >`
      SELECT
        p.id,
        p.user_id,
        p.description,
        p.years_experience,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(u.longitude::float, u.latitude::float), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography
        ) AS distance_m,
        u.full_name,
        u.address,
        u.profile_photo_url,
        u.rating,
        u.rating_count
      FROM professionals p
      JOIN users u ON u.id = p.user_id
      WHERE u.is_active = true
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(u.longitude::float, u.latitude::float), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography,
          ${radiusMeters}
        )
        ${categoryId ? prisma.$queryRaw`AND EXISTS (
          SELECT 1 FROM professional_categories pc
          WHERE pc.professional_id = p.id
          AND pc.category_id = ${categoryId}
        )` : prisma.$queryRaw``}
      ORDER BY distance_m ASC
      LIMIT 50
    `;

    // Fetch categories for each professional
    if (results.length === 0) return [];

    const professionalIds = results.map((r) => r.id);
    const categoriesData = await prisma.professionalCategory.findMany({
      where: { professionalId: { in: professionalIds } },
      include: { category: true },
    });

    // Group categories by professional ID
    const categoriesByProfId = new Map<number, CategoryResponse[]>();
    for (const pc of categoriesData) {
      if (!categoriesByProfId.has(pc.professionalId)) {
        categoriesByProfId.set(pc.professionalId, []);
      }
      categoriesByProfId.get(pc.professionalId)!.push({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
        icon: pc.category.icon,
      });
    }

    return results.map((r) => ({
      id: r.id,
      userId: r.user_id,
      description: r.description,
      yearsExperience: r.years_experience,
      distanceKm: Math.round(Number(r.distance_m) / 100) / 10, // Round to 1 decimal
      categories: categoriesByProfId.get(r.id) || [],
      user: {
        id: r.user_id,
        fullName: r.full_name,
        address: r.address,
        profilePhotoUrl: r.profile_photo_url || undefined,
        rating: Number(r.rating),
        ratingCount: r.rating_count,
      },
    }));
  }

  // ============================================================
  // CERTIFICATIONS
  // ============================================================

  /**
   * Upload a certification document, create DB record with status: pending
   */
  async uploadCertification(
    userId: number,
    file: Express.Multer.File
  ): Promise<CertificationResponse> {
    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    // Upload to Cloudinary
    const fileUrl = await uploadService.uploadCertification(file, professional.id);

    // Create certification record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certification = await (prisma.certification as any).create({
      data: {
        professionalId: professional.id,
        fileUrl,
        status: 'pending',
      },
    });

    return {
      id: certification.id,
      fileUrl: certification.fileUrl,
      status: 'pending',
      uploadedAt: certification.uploadedAt,
    };
  }

  /**
   * List certifications for the authenticated professional
   */
  async getCertifications(userId: number): Promise<CertificationResponse[]> {
    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certifications = await (prisma.certification as any).findMany({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return certifications.map(
      (cert: { id: number; fileUrl: string; status: string; uploadedAt: Date }) => ({
        id: cert.id,
        fileUrl: cert.fileUrl,
        status: cert.status as 'pending' | 'approved' | 'rejected',
        uploadedAt: cert.uploadedAt,
      })
    );
  }

  /**
   * Soft-delete a certification (professional can remove pending certs only)
   * Approved/rejected certs require admin action to remove
   */
  async deleteCertification(userId: number, certId: number): Promise<void> {
    const professional = await prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certification = await (prisma.certification as any).findUnique({
      where: { id: certId },
    });

    if (!certification) {
      throw new AppError(404, 'Certification not found');
    }

    if (certification.professionalId !== professional.id) {
      throw new AppError(403, 'You do not have permission to delete this certification');
    }

    if (certification.deletedAt !== null) {
      throw new AppError(404, 'Certification not found');
    }

    // Only pending certifications can be deleted by the professional
    if (certification.status !== 'pending') {
      throw new AppError(
        403,
        'Only pending certifications can be deleted. Contact support to remove approved or rejected certifications.'
      );
    }

    await uploadService.deleteFile(certification.fileUrl);

    // Soft delete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.certification as any).update({
      where: { id: certId },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================================
  // FORMATTERS
  // ============================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatProfessionalProfile(professional: any): ProfessionalProfileResponse {
    const categories: CategoryResponse[] = professional.categories.map(
      (pc: { category: { id: number; name: string; slug: string; icon: string } }) => ({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
        icon: pc.category.icon,
      })
    );

    const certifications: CertificationResponse[] = professional.certifications.map(
      (cert: { id: number; fileUrl: string; status: string; uploadedAt: Date }) => ({
        id: cert.id,
        fileUrl: cert.fileUrl,
        status: cert.status as 'pending' | 'approved' | 'rejected',
        uploadedAt: cert.uploadedAt,
      })
    );

    return {
      id: professional.id,
      userId: professional.userId,
      description: professional.description,
      yearsExperience: professional.yearsExperience,
      categories,
      certifications,
      user: {
        id: professional.user.id,
        fullName: professional.user.fullName,
        email: professional.user.email,
        phone: professional.user.phone,
        address: professional.user.address,
        profilePhotoUrl: professional.user.profilePhotoUrl || undefined,
        rating: Number(professional.user.rating),
        ratingCount: professional.user.ratingCount,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatPublicProfile(professional: any): PublicProfessionalResponse {
    const categories: CategoryResponse[] = professional.categories.map(
      (pc: { category: { id: number; name: string; slug: string; icon: string } }) => ({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
        icon: pc.category.icon,
      })
    );

    const certifications: CertificationResponse[] = professional.certifications.map(
      (cert: { id: number; fileUrl: string; status: string; uploadedAt: Date }) => ({
        id: cert.id,
        fileUrl: cert.fileUrl,
        status: cert.status as 'pending' | 'approved' | 'rejected',
        uploadedAt: cert.uploadedAt,
      })
    );

    return {
      id: professional.id,
      userId: professional.userId,
      description: professional.description,
      yearsExperience: professional.yearsExperience,
      categories,
      certifications,
      user: {
        id: professional.user.id,
        fullName: professional.user.fullName,
        address: professional.user.address,
        profilePhotoUrl: professional.user.profilePhotoUrl || undefined,
        rating: Number(professional.user.rating),
        ratingCount: professional.user.ratingCount,
      },
    };
  }
}

export const professionalService = new ProfessionalService();
