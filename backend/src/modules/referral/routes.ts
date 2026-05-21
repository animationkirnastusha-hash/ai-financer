import { Router } from 'express';
import { applyReferralCode, getReferralInfo } from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getReferralInfo);
router.post('/apply', applyReferralCode);

export default router;
