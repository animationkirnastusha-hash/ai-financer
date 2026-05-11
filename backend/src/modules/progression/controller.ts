import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { progressionService } from './service';
import type { ActivityType } from './types';

function getUserId(req: Request) {
  return (req as AuthRequest).userId;
}

export async function getProgression(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const snapshot = await progressionService.getSnapshot(userId);
  return res.json(snapshot);
}

export async function trackActivity(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const result = await progressionService.trackActivity(
    userId,
    String(req.body?.type ?? 'daily_activity') as ActivityType,
    req.body?.payload,
  );

  return res.status(201).json(result);
}

export async function applyReferralCode(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const snapshot = await progressionService.applyReferralCode(userId, req.body?.code);
  return res.json(snapshot);
}

export async function activateMyReferralStatus(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const result = await progressionService.activateReferral(userId);
  return res.json({ activated: Boolean(result), result });
}
