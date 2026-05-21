import { Response } from 'express';
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
