import { prisma } from '../../lib/prisma';

type SaveMessagePayload = {
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: Record<string, unknown>;
};

export class AIMemoryService {
  async saveMessage(payload: SaveMessagePayload) {
    try {
      await prisma.aIMessage.create({
        data: {
          userId: payload.userId,
          role: payload.role,
          content: payload.content,
          meta: payload.meta ? JSON.stringify(payload.meta) : null,
        },
      });
    } catch (error) {
      console.error('[AIMemory] saveMessage failed:', error);
    }
  }

  async getRecentMessages(userId: string, limit = 8) {
    try {
      const messages = await prisma.aIMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return messages.reverse();
    } catch (error) {
      console.error('[AIMemory] getRecentMessages failed:', error);
      return [];
    }
  }
} 