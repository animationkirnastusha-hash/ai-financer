import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { aiSettingsService } from './service';
import type { AISettingsPreset } from './types';

function userId(req: Request) {
  const id = req.userId;
  if (!id) throw new BadRequestError('Unauthorized user');
  return id;
}

export const getAISettings = asyncHandler(async (req: Request, res: Response) => {
  const snapshot = await aiSettingsService.getSettings(userId(req));
  res.json(snapshot);
});

export const updateAISettings = asyncHandler(async (req: Request, res: Response) => {
  const snapshot = await aiSettingsService.updateSettings(userId(req), req.body ?? {});
  res.json(snapshot);
});

export const applyAISettingsPreset = asyncHandler(async (req: Request, res: Response) => {
  const preset = String(req.body?.preset ?? req.params.preset ?? '') as AISettingsPreset;
  const snapshot = await aiSettingsService.applyPreset(userId(req), preset);
  res.json(snapshot);
});

export const getOnboarding = asyncHandler(async (req: Request, res: Response) => {
  const state = await aiSettingsService.getOnboarding(userId(req));
  res.json(state);
});

export const updateOnboarding = asyncHandler(async (req: Request, res: Response) => {
  const state = await aiSettingsService.updateOnboarding(userId(req), req.body ?? {});
  res.json(state);
});

export const restartOnboarding = asyncHandler(async (req: Request, res: Response) => {
  const state = await aiSettingsService.restartOnboarding(userId(req));
  res.json(state);
});
