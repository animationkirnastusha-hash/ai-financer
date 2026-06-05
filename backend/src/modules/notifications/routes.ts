import { Router } from 'express';
import {
  getNotifications,
  getNotificationSettings,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  updateNotificationSettings,
  deleteNotification,
} from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/settings', getNotificationSettings);
router.patch('/settings', updateNotificationSettings);
router.post('/read-all', markAllNotificationsAsRead);
router.post('/:id/read', markNotificationAsRead);
router.delete('/:id', deleteNotification);

export default router;
