import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getFinancialCycle, updateFinancialCycle } from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/', getFinancialCycle);
router.patch('/', updateFinancialCycle);

export default router;
