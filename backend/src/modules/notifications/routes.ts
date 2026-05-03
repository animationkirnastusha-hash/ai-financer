import { Router } from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getNotifications);
router.post('/read-all', markAllNotificationsAsRead);
router.post('/:id/read', markNotificationAsRead);
router.delete('/:id', deleteNotification);

export default router;