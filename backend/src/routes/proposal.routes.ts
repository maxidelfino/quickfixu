import { Router } from 'express';
import { proposalController } from '../controllers/proposal.controller';
import { requireAuth, isProfessional } from '../middleware/auth.middleware';
import { requireClientRole } from '../middleware/client.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createProposalSchema } from '../validators/marketplace.validators';

const router = Router();

router.use(requireAuth);

router.post('/', isProfessional, validateBody(createProposalSchema), proposalController.create);
router.get('/:id([0-9]+)', proposalController.getById);
router.post('/:id([0-9]+)/accept', requireClientRole, proposalController.accept);

export default router;
