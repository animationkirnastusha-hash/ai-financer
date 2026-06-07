import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { businessWorkspaceService } from './service';

function requireUserId(req: Request) {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
}

export const getMyBusinessWorkspace = asyncHandler(async (req: Request, res: Response) => {
  res.json(await businessWorkspaceService.getWorkspace(requireUserId(req)));
});

export const updateMyBusinessWorkspace = asyncHandler(async (req: Request, res: Response) => {
  res.json(await businessWorkspaceService.updateWorkspace(requireUserId(req), req.body ?? {}));
});
