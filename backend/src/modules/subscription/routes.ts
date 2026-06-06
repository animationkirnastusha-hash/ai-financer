import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getMySubscription, startMyTrial } from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/me', getMySubscription);
router.post('/trial/start', startMyTrial);

export default router;
