import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError, ConflictError } from '../../shared/core/errors';
import { AIService } from './service';
import { aiRateLimitService } from './ai-rate-limit.service';
import { aiIdempotencyService } from './ai-idempotency.service';
import { aiResponseNormalizer } from './ai-response-normalizer.service';
import { aiObservability } from './ai-observability.service';
import { subscriptionService } from '../subscription/service';
import { aiTrainingExampleService } from './ai-training-example.service';

const aiService = new AIService();

function parseBoolean(value: unknown, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
}

function parseLimit(value: unknown, fallback = 50) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new BadRequestError('limit must be a positive number');
  return parsed;
}

function readPendingActionId(req: Request) {
  const fromParams = req.params.pendingActionId;
  const fromBody = req.body?.pendingActionId ?? req.body?.id;

  if (typeof fromParams === 'string' && fromParams.trim()) return fromParams.trim();
  if (Array.isArray(fromParams) && typeof fromParams[0] === 'string') return fromParams[0].trim();
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  if (Array.isArray(fromBody) && typeof fromBody[0] === 'string') return fromBody[0].trim();

  return '';
}


function readCommandSource(value: unknown) {
  return value === 'voice' || value === 'voice_session' ? value : 'text';
}

function readVoiceSession(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const segmentsRaw = Array.isArray(record.segments) ? record.segments : [];
  const segments = segmentsRaw
    .map((item): { text: string; role: 'initial' | 'continuation' | 'correction'; at?: number } | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const segment = item as Record<string, unknown>;
      const text = typeof segment.text === 'string' ? segment.text.trim().slice(0, 500) : '';
      const roleRaw = typeof segment.role === 'string' ? segment.role : 'continuation';
      const role = roleRaw === 'initial' || roleRaw === 'correction' || roleRaw === 'continuation' ? roleRaw : 'continuation';
      const at = Number(segment.at);
      if (!text) return null;
      return { text, role, at: Number.isFinite(at) ? at : undefined };
    })
    .filter((segment): segment is { text: string; role: 'initial' | 'continuation' | 'correction'; at?: number } => Boolean(segment))
    .slice(0, 8);

  return {
    id: typeof record.id === 'string' ? record.id.slice(0, 80) : undefined,
    finalText: typeof record.finalText === 'string' ? record.finalText.trim().slice(0, 1500) : undefined,
    correctionCount: Number.isFinite(Number(record.correctionCount)) ? Number(record.correctionCount) : undefined,
    segments,
  };
}

function readIdempotencyKey(req: Request) {
  const header = req.header('x-idempotency-key');
  const body = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : '';

  return String(header || body || '').trim().slice(0, 128);
}

async function withIdempotency<T>(
  userId: string,
  scope: string,
  key: string,
  payload: unknown,
  run: () => Promise<T>,
  state?: { cached?: boolean },
): Promise<T> {
  if (!key) {
    if (state) state.cached = false;
    return run();
  }

  const requestHash = aiIdempotencyService.hashPayload(payload);
  const existing = await aiIdempotencyService.get(userId, scope, key, requestHash);

  if (existing?.conflict) {
    throw new ConflictError('Idempotency key already used with a different payload');
  }

  if (existing?.response) {
    if (state) state.cached = true;
    return existing.response as T;
  }

  if (state) state.cached = false;
  const response = await run();
  await aiIdempotencyService.save(userId, scope, key, requestHash, response);

  return response;
}

export const parseCommand = asyncHandler(async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  aiRateLimitService.assertAllowed({ userId, scope: 'parse' });

  const command = typeof req.body.command === 'string' ? req.body.command : '';
  const execute = req.body.execute === undefined ? true : Boolean(req.body.execute);
  if (!command.trim()) throw new BadRequestError('command is required');

  const source = readCommandSource(req.body?.source);
  const voiceSession = readVoiceSession(req.body?.voiceSession);
  const key = readIdempotencyKey(req);

  const isVoiceSource = source === 'voice' || source === 'voice_session';
  const voiceUsageBefore = isVoiceSource ? await subscriptionService.assertVoiceCommandAllowed(userId) : null;

  const idempotencyState: { cached?: boolean } = {};
  const result = await withIdempotency(userId, 'ai_parse', key, { command, execute, source, voiceSession }, async () => {
    const raw = await aiService.handleCommand(userId, command, { execute, source, voiceSession });
    const normalized = aiResponseNormalizer.normalize(raw);
    if (!execute && !normalized.executed) {
      normalized.meta = { ...(normalized.meta ?? {}), dryRun: true };
    }
    return normalized;
  }, idempotencyState);

  let subscriptionUsage = voiceUsageBefore;
  if (isVoiceSource && !idempotencyState.cached && result.success && (result.executed || result.requiresConfirmation)) {
    const updatedStatus = await subscriptionService.recordUsage(userId, 'voiceCommands', {
      source,
      intent: result.intent,
      executed: result.executed,
      requiresConfirmation: result.requiresConfirmation,
      voiceSessionId: voiceSession?.id,
    });
    subscriptionUsage = updatedStatus.usage.voiceCommandsToday;
  }

  if (!idempotencyState.cached) {
    void aiTrainingExampleService.captureFromResult({
      userId,
      command,
      result,
      latencyMs: Date.now() - startedAt,
      model: process.env.AI_MODEL || process.env.OPENAI_MODEL || null || undefined,
    }).catch((error) => {
      console.warn('[AI] training example capture failed', error instanceof Error ? error.message : error);
    });
  }

  await aiObservability.log({
    userId,
    type: 'ai_parse',
    severity: result.success ? 'info' : 'warn',
    scope: result.intent,
    message: result.message,
    payload: {
      executed: result.executed,
      requiresConfirmation: result.requiresConfirmation,
      riskLevel: result.riskLevel,
      source,
      voiceSessionId: voiceSession?.id,
      voiceSegmentCount: voiceSession?.segments?.length ?? 0,
    },
  });

  res.json(subscriptionUsage
    ? {
        ...result,
        meta: {
          ...(result.meta ?? {}),
          subscriptionUsage: {
            voiceCommandsToday: subscriptionUsage,
          },
        } as typeof result.meta & Record<string, unknown>,
      }
    : result);
});

export const confirmCommand = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  aiRateLimitService.assertAllowed({ userId, scope: 'confirm' });

  const pendingActionId = readPendingActionId(req);
  if (!pendingActionId.trim()) throw new BadRequestError('pendingActionId is required');

  // Confirmation must never be served from a cached idempotency response.
  // A stale confirm cache can make the UI believe an action was handled while
  // the business executor did not mutate accounts/transactions/goals.
  const raw = await aiService.confirmCommand(userId, pendingActionId);
  const result = aiResponseNormalizer.normalize(raw);

  await aiObservability.log({
    userId,
    type: 'ai_confirm',
    severity: result.success ? 'info' : 'error',
    scope: result.intent,
    message: result.message,
    payload: {
      pendingActionId,
      executed: result.executed,
      riskLevel: result.riskLevel,
    },
  });

  res.json(result);
});

export const updatePendingAction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  const pendingActionId = readPendingActionId(req);
  if (!pendingActionId.trim()) throw new BadRequestError('pendingActionId is required');

  const parsed = req.body?.parsed ?? req.body;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestError('parsed payload is required');
  }

  const command = typeof req.body?.command === 'string' ? req.body.command : undefined;
  const result = await aiService.updatePendingAction(userId, pendingActionId, parsed as Record<string, unknown>, command);
  res.json(result);
});

export const cancelCommand = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  const pendingActionId = readPendingActionId(req);
  if (!pendingActionId.trim()) throw new BadRequestError('pendingActionId is required');

  const result = await aiService.cancelCommand(userId, pendingActionId);
  res.json(aiResponseNormalizer.normalize(result));
});

export const getPendingActions = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  const includeExpired = parseBoolean(req.query.includeExpired, false);
  const pendingActions = await aiService.getPendingActions(userId, includeExpired);
  res.json({ pendingActions });
});

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  const limit = parseLimit(req.query.limit, 50);
  const auditLogs = await aiService.getAuditLogs(userId, limit);
  res.json({ auditLogs });
});

export const undoCommand = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  aiRateLimitService.assertAllowed({ userId, scope: 'confirm' });

  const auditLogId = typeof req.body.auditLogId === 'string' ? req.body.auditLogId : '';
  if (!auditLogId.trim()) throw new BadRequestError('auditLogId is required');

  const key = readIdempotencyKey(req) || `undo:${auditLogId}`;

  const result = await withIdempotency(userId, 'ai_undo', key, { auditLogId }, async () => {
    return aiService.undoByAuditLog(userId, auditLogId);
  });

  await aiObservability.log({
    userId,
    type: 'ai_undo',
    severity: 'warn',
    scope: 'undo',
    message: 'Undo requested',
    payload: { auditLogId, result },
  });

  res.json(result);
});

export const getObservabilityEvents = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) throw new BadRequestError('Unauthorized user');

  const limit = parseLimit(req.query.limit, 50);
  const events = await aiObservability.list(userId, limit);
  res.json({ events });
});
