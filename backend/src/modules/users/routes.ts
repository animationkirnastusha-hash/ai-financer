import { Router } from 'express';
import { getProfile, updateProfile } from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/me', getProfile);
router.put('/me', updateProfile);

export default router;