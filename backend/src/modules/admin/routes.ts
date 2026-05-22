import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { adminMiddleware } from '../../middleware/admin';
import { getAdminEvents, getAdminMonitoring, getAdminOverview, getAdminUsers, resetAdminAllUsers, resetAdminUser } from './controller';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.get('/events', getAdminEvents);
router.get('/monitoring', getAdminMonitoring);
router.post('/users/:userId/reset', resetAdminUser);
router.post('/reset', resetAdminAllUsers);

export default router;
