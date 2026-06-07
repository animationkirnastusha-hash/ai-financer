import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getMyBusinessWorkspace, updateMyBusinessWorkspace } from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/me', getMyBusinessWorkspace);
router.put('/me', updateMyBusinessWorkspace);

export default router;
