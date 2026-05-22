import { Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import type { AuthRequest } from '../../middleware/auth';
import { dataResetService } from './service';

export const resetCurrentUserData = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await dataResetService.reset({ userId: req.userId! }, req.body?.mode);
  res.json({ success: true, result });
});
