import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/:id([0-9]+)/confirm-completion', appointmentController.confirmCompletion);

export default router;
