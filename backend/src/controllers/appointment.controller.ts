import { Request, Response, NextFunction } from 'express';
import { marketplaceService } from '../services/marketplace.service';
import { AppError } from '../types/errors.types';

class AppointmentController {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const appointment = await marketplaceService.getAppointmentById(req.user!, appointmentId);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  }

  async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const appointment = await marketplaceService.scheduleAppointment(req.user!, appointmentId, req.body);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const appointment = await marketplaceService.updateAppointment(req.user!, appointmentId, req.body);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const appointment = await marketplaceService.cancelAppointment(req.user!, appointmentId, req.body);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const appointment = await marketplaceService.startAppointment(req.user!, appointmentId);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  }

  async confirmCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const appointment = await marketplaceService.confirmAppointmentCompletion(req.user!, appointmentId);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  }

  async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const review = await marketplaceService.createAppointmentReview(req.user!, appointmentId, req.body);
      res.status(201).json(review);
    } catch (error) {
      next(error);
    }
  }

  async listReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = parseInt(req.params.id, 10);
      if (isNaN(appointmentId)) {
        throw new AppError(400, 'Invalid appointment ID');
      }

      const reviews = await marketplaceService.listAppointmentReviews(req.user!, appointmentId);
      res.status(200).json({ count: reviews.length, reviews });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
