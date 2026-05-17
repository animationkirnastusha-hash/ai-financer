import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  applyAISettingsPreset,
  getAISettings,
  getOnboarding,
  restartOnboarding,
  updateAISettings,
  updateOnboarding,
} from './controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getAISettings);
router.patch('/', updateAISettings);
router.post('/preset/:preset', applyAISettingsPreset);
router.post('/preset', applyAISettingsPreset);

router.get('/onboarding', getOnboarding);
router.patch('/onboarding', updateOnboarding);
router.post('/onboarding/restart', restartOnboarding);

export default router;
