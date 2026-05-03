import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { NotificationService } from './service';

const notificationService = new NotificationService();

function getStringParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await notificationService.getUserNotifications(req.userId!);
  res.json({ notifications });
});

export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response) => {
  const notificationId = getStringParam(req.params.id, 'Notification id');
  const notification = await notificationService.markAsRead(req.userId!, notificationId);

  res.json({
    message: 'Notification marked as read',
    notification,
  });
});

export const markAllNotificationsAsRead = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.markAllAsRead(req.userId!);

  res.json({
    message: 'All notifications marked as read',
    ...result,
  });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const notificationId = getStringParam(req.params.id, 'Notification id');
  const notification = await notificationService.deleteNotification(req.userId!, notificationId);

  res.json({
    message: 'Notification deleted successfully',
    notification,
  });
});