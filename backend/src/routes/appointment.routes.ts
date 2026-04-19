import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  cancelAppointmentSchema,
  createReviewSchema,
  scheduleAppointmentSchema,
  updateAppointmentSchema,
} from '../validators/marketplace.validators';

const router = Router();

router.use(requireAuth);

router.get('/:id([0-9]+)', appointmentController.getById);
router.post('/:id([0-9]+)/schedule', validateBody(scheduleAppointmentSchema), appointmentController.schedule);
router.patch('/:id([0-9]+)', validateBody(updateAppointmentSchema), appointmentController.update);
router.post('/:id([0-9]+)/cancel', validateBody(cancelAppointmentSchema), appointmentController.cancel);
router.post('/:id([0-9]+)/start', appointmentController.start);
router.post('/:id([0-9]+)/confirm-completion', appointmentController.confirmCompletion);
router.get('/:id([0-9]+)/reviews', appointmentController.listReviews);
router.post('/:id([0-9]+)/reviews', validateBody(createReviewSchema), appointmentController.createReview);

export default router;
