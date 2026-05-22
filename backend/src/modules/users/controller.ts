import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../shared/core/errors';
import { dataResetService } from '../data-reset/service';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({ user });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      firstName: req.body.firstName ?? user.firstName,
      lastName: req.body.lastName ?? user.lastName,
      username: req.body.username ?? user.username,
      photoUrl: req.body.photoUrl ?? user.photoUrl,
    },
  });

  res.json({
    message: 'Profile updated successfully',
    user: updatedUser,
  });
});
export const resetCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await dataResetService.reset({ userId: req.userId! }, req.body?.mode);
  res.json({ success: true, result });
});
