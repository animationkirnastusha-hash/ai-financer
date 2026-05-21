import { randomUUID } from 'crypto';
import { Response } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import type { AuthRequest } from '../../middleware/auth';
import { ensureProductAnalyticsSchema } from './bootstrap';

const ALLOWED_EVENTS = new Set([
  'session_start',
  'screen_view',
  'ai_command_submitted',
  'ai_confirmed',
  'ai_cancelled',
  'transaction_created',
  'referral_opened',
  'referral_code_copied',
  'referral_code_applied',
]);

type TrackEventBody = {
  event?: string;
  data?: Record<string, unknown>;
};

function sanitizeData(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const allowed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key.length > 80) continue;

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      allowed[key] = typeof value === 'string' ? value.slice(0, 500) : value;
    }
  }

  return Object.keys(allowed).length ? allowed : null;
}

export const trackProductEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as TrackEventBody;
  const event = body.event?.trim();

  if (!event || event.length > 120) {
    return res.status(400).json({ error: { message: 'Invalid event name', code: 'INVALID_EVENT' } });
  }

  if (!ALLOWED_EVENTS.has(event)) {
    return res.status(400).json({ error: { message: 'Unsupported event', code: 'UNSUPPORTED_EVENT' } });
  }

  await ensureProductAnalyticsSchema();

  const safeData = sanitizeData(body.data);

  await prisma.productEvent.create({
    data: {
      id: randomUUID(),
      userId: req.userId ?? null,
      event,
      data: safeData ? JSON.stringify(safeData).slice(0, 4000) : null,
    },
  });

  res.status(204).send();
});
