import { Router } from 'express';
import { getProfile, resetCurrentUser, updateProfile } from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.post('/me/reset', resetCurrentUser);

export default router;