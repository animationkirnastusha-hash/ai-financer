import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import type { AuthRequest } from '../../middleware/auth';
import { AdminService } from './service';

const adminService = new AdminService();

export const getAdminOverview = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json(await adminService.getOverview());
});

export const getAdminUsers = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({ users: await adminService.getUsers() });
});

export const getAdminEvents = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({ events: await adminService.getEvents() });
});

export const getAdminMonitoring = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json(adminService.getMonitoring());
});

export const resetAdminUser = asyncHandler(async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

  const result = await adminService.resetUser(userId, req.body?.mode);
  res.json({ success: true, result });
});

export const resetAdminAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.resetAllUsers(req.body?.mode);
  res.json({ success: true, result });
});


export const grantAdminSubscription = asyncHandler(async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const result = await adminService.grantSubscription(userId, req.body);
  res.json({ success: true, result });
});

export const revokeAdminSubscription = asyncHandler(async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const result = await adminService.revokeSubscription(userId, req.body);
  res.json({ success: true, result });
});

export const restartAdminTrial = asyncHandler(async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const result = await adminService.restartTrial(userId);
  res.json({ success: true, result });
});
