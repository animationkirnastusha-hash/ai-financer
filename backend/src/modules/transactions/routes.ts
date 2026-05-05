import { Router } from 'express';
import {
  getTransactions,
  getTransaction,
  getLatestTransaction,
  getTransactionStats,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getTransactions);
router.get('/latest', getLatestTransaction);
router.get('/stats/monthly', getTransactionStats);
router.get('/:id', getTransaction);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.patch('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
