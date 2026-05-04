import { prisma } from '../../lib/prisma';

type TrackEventPayload = {
  userId?: string | null;
  event: string;
  data?: Record<string, unknown> | null;
};

export class ProductEventsService {
  async track(payload: TrackEventPayload) {
    try {
      await prisma.productEvent.create({
        data: {
          userId: payload.userId ?? null,
          event: payload.event,
          data: payload.data ? JSON.stringify(payload.data) : null,
        },
      });
    } catch (error) {
      console.error('[ProductEvents] track failed:', error);
    }
  }
}