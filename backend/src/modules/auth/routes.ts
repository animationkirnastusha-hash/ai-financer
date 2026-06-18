import { Router } from 'express';
import {
  getFallbackInfo,
  getMe,
  login,
  updateLocale,
  telegramFallbackWebhook,
  verifyFallbackCode,
} from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.patch('/locale', authMiddleware, updateLocale);
router.get('/fallback/info', getFallbackInfo);
router.post('/fallback/verify-code', verifyFallbackCode);
router.post('/fallback/telegram-webhook', telegramFallbackWebhook);

export default router;
