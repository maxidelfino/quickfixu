// src/controllers/category.controller.ts
// Category controller - HTTP handlers for /api/categories/* routes

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../types/errors.types';
import { professionalService } from '../services/professional.service';

class CategoryController {
  /**
   * GET /api/categories
   * Get all categories (public)
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
        },
      });

      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/categories/:slug
   * Get category by slug (public)
   */
  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;

      const category = await prisma.category.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
        },
      });

      if (!category) {
        throw new AppError(404, `Category with slug "${slug}" not found`);
      }

      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/categories/:slug/professionals
   * Get all professionals in a category (public)
   * Supports query params: lat, lng, radius (km) for location filtering
   */
  async getProfessionals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;

      // Find category by slug first
      const category = await prisma.category.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
      });

      if (!category) {
        throw new AppError(404, `Category with slug "${slug}" not found`);
      }

      const { lat, lng, radius } = req.query;

      // If location params provided, delegate to geo search
      if (lat && lng && radius) {
        const latitude = parseFloat(String(lat));
        const longitude = parseFloat(String(lng));
        const radiusKm = parseFloat(String(radius));

        if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
          throw new AppError(400, 'lat, lng, and radius must be valid numbers');
        }

        const results = await professionalService.searchByLocation(
          latitude,
          longitude,
          radiusKm,
          category.id
        );

        return void res.status(200).json({ count: results.length, results });
      }

      // Otherwise fetch all professionals in category
      const professionals = await prisma.professionalCategory.findMany({
        where: { categoryId: category.id },
        include: {
          professional: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  address: true,
                  profilePhotoUrl: true,
                  rating: true,
                  ratingCount: true,
                  isActive: true,
                },
              },
              categories: {
                include: { category: true },
              },
            },
          },
        },
      });

      // Filter only active users
      const activeResults = professionals
        .filter((pc) => pc.professional.user.isActive)
        .map((pc) => ({
          id: pc.professional.id,
          userId: pc.professional.userId,
          description: pc.professional.description,
          yearsExperience: pc.professional.yearsExperience,
          categories: pc.professional.categories.map((c) => ({
            id: c.category.id,
            name: c.category.name,
            slug: c.category.slug,
            icon: c.category.icon,
          })),
          user: {
            id: pc.professional.user.id,
            fullName: pc.professional.user.fullName,
            address: pc.professional.user.address,
            profilePhotoUrl: pc.professional.user.profilePhotoUrl || undefined,
            rating: Number(pc.professional.user.rating),
            ratingCount: pc.professional.user.ratingCount,
          },
        }));

      res.status(200).json({ count: activeResults.length, results: activeResults });
    } catch (error) {
      next(error);
    }
  }
}

export const categoryController = new CategoryController();
