import { Response } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import type { AuthRequest } from '../../middleware/auth';

type TrackEventBody = {
  event?: string;
  data?: Record<string, unknown>;
};

export const trackProductEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as TrackEventBody;
  const event = body.event?.trim();

  if (!event || event.length > 120) {
    return res.status(400).json({ error: { message: 'Invalid event name', code: 'INVALID_EVENT' } });
  }

  const safeData = body.data && typeof body.data === 'object' ? body.data : null;

  await prisma.productEvent.create({
    data: {
      userId: req.userId ?? null,
      event,
      data: safeData ? JSON.stringify(safeData).slice(0, 4000) : null,
    },
  });

  res.status(204).send();
});
