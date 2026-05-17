import { Request, Response } from 'express';
import { BadRequestError } from '../../shared/core/errors';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { companionFacadeService } from './service';

function userId(req: Request) {
  const id = req.userId;
  if (!id) throw new BadRequestError('Unauthorized user');
  return id;
}

function limit(value: unknown, fallback = 10) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 50) : fallback;
}

export const getCompanionState = asyncHandler(async (req: Request, res: Response) => {
  const state = await companionFacadeService.getState(userId(req));
  res.json(state);
});

export const getCompanionEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await companionFacadeService.getEvents(userId(req), {
    limit: limit(req.query.limit, 10),
    onlyUnseen: String(req.query.onlyUnseen ?? '').toLowerCase() === 'true',
  });

  res.json({ events });
});

export const markCompanionEventsSeen = asyncHandler(async (req: Request, res: Response) => {
  const result = await companionFacadeService.markSeen(userId(req));
  res.json(result);
});
