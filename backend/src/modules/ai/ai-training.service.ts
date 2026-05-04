import { prisma } from '../../lib/prisma';

type SaveTrainingExamplePayload = {
  userId?: string | null;
  input: string;
  aiOutput?: unknown;
  correctedOutput?: unknown;
  success: boolean;
  error?: string | null;
  model?: string | null;
  latencyMs?: number | null;
};

export class AITrainingService {
  async save(payload: SaveTrainingExamplePayload) {
    try {
      await prisma.aITrainingExample.create({
        data: {
          userId: payload.userId ?? null,
          input: payload.input,
          aiOutput:
            payload.aiOutput === undefined
              ? null
              : JSON.stringify(payload.aiOutput),
          correctedOutput:
            payload.correctedOutput === undefined
              ? null
              : JSON.stringify(payload.correctedOutput),
          success: payload.success,
          error: payload.error ?? null,
          model: payload.model ?? null,
          latencyMs:
            typeof payload.latencyMs === 'number'
              ? Math.round(payload.latencyMs)
              : null,
        },
      });
    } catch (error) {
      console.error('[AITraining] save failed:', error);
    }
  }
}