import { Router } from 'express';
import {
  getRecurringPayments,
  getRecurringPayment,
  createRecurringPayment,
  updateRecurringPayment,
  deleteRecurringPayment,
} from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getRecurringPayments);
router.get('/:id', getRecurringPayment);
router.post('/', createRecurringPayment);
router.put('/:id', updateRecurringPayment);
router.delete('/:id', deleteRecurringPayment);

export default router;