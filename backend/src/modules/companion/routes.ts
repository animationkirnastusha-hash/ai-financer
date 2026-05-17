import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  getCompanionEvents,
  getCompanionState,
  markCompanionEventsSeen,
} from './controller';

const router = Router();

router.use(authMiddleware);

router.get('/state', getCompanionState);
router.get('/events', getCompanionEvents);
router.post('/events/seen', markCompanionEventsSeen);

export default router;
