import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { trackProductEvent } from './controller';

const router = Router();

router.post('/events', authMiddleware, trackProductEvent);

export default router;
