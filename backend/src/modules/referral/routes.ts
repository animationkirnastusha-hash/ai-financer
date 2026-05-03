import { Router } from 'express';
import { getReferralInfo } from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getReferralInfo);

export default router;