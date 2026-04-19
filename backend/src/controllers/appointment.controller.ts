import { Request, Response, NextFunction } from 'express';
import { marketplaceService } from '../services/marketplace.service';
import { AppError } from '../types/errors.types';

class AppointmentController {
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
}

export const appointmentController = new AppointmentController();
