import { Router } from 'express';
import {
  getNotifications,
  getNotificationSettings,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  updateNotificationSettings,
  deliverTelegramNotifications,
  deleteNotification,
} from './controller';
import { authMiddleware } from '../../middleware/auth';
import { adminMiddleware } from '../../middleware/admin';

const router = Router();

router.use(authMiddleware);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/settings', getNotificationSettings);
router.post('/deliver-telegram', adminMiddleware, deliverTelegramNotifications);
router.patch('/settings', updateNotificationSettings);
router.post('/read-all', markAllNotificationsAsRead);
router.post('/:id/read', markNotificationAsRead);
router.delete('/:id', deleteNotification);

export default router;
