import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { adminMiddleware } from '../../middleware/admin';
import { getAdminAITrainingExamples, getAdminEvents, getAdminMonitoring, getAdminOverview, getAdminUsers, grantAdminSubscription, resetAdminAllUsers, resetAdminUser, restartAdminTrial, revokeAdminSubscription, updateAdminAITrainingExample } from './controller';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.get('/events', getAdminEvents);
router.get('/monitoring', getAdminMonitoring);
router.get('/ai-training', getAdminAITrainingExamples);
router.patch('/ai-training/:exampleId', updateAdminAITrainingExample);
router.post('/users/:userId/reset', resetAdminUser);
router.post('/users/:userId/subscription/grant', grantAdminSubscription);
router.post('/users/:userId/subscription/revoke', revokeAdminSubscription);
router.post('/users/:userId/trial/restart', restartAdminTrial);
router.post('/reset', resetAdminAllUsers);

export default router;
