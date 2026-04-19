import { Router } from 'express';
import { requestController } from '../controllers/request.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireClientRole } from '../middleware/client.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createRequestSchema } from '../validators/marketplace.validators';

const router = Router();

router.use(requireAuth);

router.get('/', requestController.list);
router.get('/:id([0-9]+)', requestController.getById);
router.get('/:id([0-9]+)/proposals', requestController.listProposals);
router.post('/', requireClientRole, validateBody(createRequestSchema), requestController.create);

export default router;
