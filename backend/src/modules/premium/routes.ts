import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getPremiumCapabilities } from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/capabilities', getPremiumCapabilities);

export default router;
