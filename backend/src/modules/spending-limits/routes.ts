import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  createSpendingLimit,
  deleteSpendingLimit,
  getSpendingLimit,
  getSpendingLimits,
  updateSpendingLimit,
} from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/', getSpendingLimits);
router.get('/:id', getSpendingLimit);
router.post('/', createSpendingLimit);
router.put('/:id', updateSpendingLimit);
router.delete('/:id', deleteSpendingLimit);

export default router;
