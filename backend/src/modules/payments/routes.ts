import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { completeMockPaymentOrder, createPaymentOrder, getPaymentCatalog, getPaymentOrder, telegramPaymentsWebhook, yookassaPaymentsWebhook } from './controller';

const router = Router();

router.post('/telegram/webhook', telegramPaymentsWebhook);
router.post('/yookassa/webhook', yookassaPaymentsWebhook);

router.use(authMiddleware);
router.get('/catalog', getPaymentCatalog);
router.post('/orders', createPaymentOrder);
router.get('/orders/:orderId', getPaymentOrder);
router.post('/orders/:orderId/mock-complete', completeMockPaymentOrder);

export default router;
