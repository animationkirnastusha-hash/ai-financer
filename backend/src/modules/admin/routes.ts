import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { adminMiddleware } from '../../middleware/admin';
import { getAdminEvents, getAdminMonitoring, getAdminOverview, getAdminUsers } from './controller';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.get('/events', getAdminEvents);
router.get('/monitoring', getAdminMonitoring);

export default router;
