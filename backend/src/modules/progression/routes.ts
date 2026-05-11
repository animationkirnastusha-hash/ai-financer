import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  activateMyReferralStatus,
  applyReferralCode,
  getProgression,
  trackActivity,
} from './controller';

const router = Router();

router.use(authMiddleware);

router.get('/me', getProgression);
router.post('/activity', trackActivity);
router.post('/referral/apply', applyReferralCode);
router.post('/referral/activate', activateMyReferralStatus);

export default router;
