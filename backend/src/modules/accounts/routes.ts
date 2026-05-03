import { Router } from 'express';
import {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getTotalBalance,
  getAccountsSummary,
  recalculateAllBalances,
} from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getAccounts);
router.get('/summary', getAccountsSummary);
router.get('/total-balance', getTotalBalance);
router.post('/recalculate-balances', recalculateAllBalances);
router.get('/:id', getAccount);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

export default router;