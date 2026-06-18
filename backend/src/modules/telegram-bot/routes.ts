import { Router } from 'express';
import { telegramBotWebhook } from './controller';

const router = Router();

router.post('/webhook', telegramBotWebhook);

export default router;
