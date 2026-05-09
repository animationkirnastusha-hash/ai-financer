import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { AIService } from './service';

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
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError('limit must be a positive number');
  }
  return parsed;
}

export const parseCommand = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new BadRequestError('Unauthorized user');
  }

  const command = typeof req.body.command === 'string' ? req.body.command : '';
  const execute = req.body.execute === undefined ? true : Boolean(req.body.execute);

  if (!command.trim()) {
    throw new BadRequestError('command is required');
  }

  const result = await aiService.handleCommand(userId, command, { execute });

  res.json(result);
});

export const confirmCommand = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new BadRequestError('Unauthorized user');
  }

  const pendingActionId =
    typeof req.body.pendingActionId === 'string' ? req.body.pendingActionId : '';

  if (!pendingActionId.trim()) {
    throw new BadRequestError('pendingActionId is required');
  }

  const result = await aiService.confirmCommand(userId, pendingActionId);

  res.json(result);
});

export const cancelCommand = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new BadRequestError('Unauthorized user');
  }

  const pendingActionId =
    typeof req.body.pendingActionId === 'string' ? req.body.pendingActionId : '';

  if (!pendingActionId.trim()) {
    throw new BadRequestError('pendingActionId is required');
  }

  const result = await aiService.cancelCommand(userId, pendingActionId);

  res.json(result);
});



export const updatePendingAction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new BadRequestError('Unauthorized user');
  }

  const pendingActionId =
    typeof req.body.pendingActionId === 'string'
      ? req.body.pendingActionId
      : typeof req.params.pendingActionId === 'string'
        ? req.params.pendingActionId
        : '';
  const parsed = req.body.parsed;
  const command = typeof req.body.command === 'string' ? req.body.command : undefined;

  if (!pendingActionId.trim()) {
    throw new BadRequestError('pendingActionId is required');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestError('parsed object is required');
  }

  const result = await aiService.updatePendingAction(
    userId,
    pendingActionId,
    parsed as Record<string, unknown>,
    command,
  );

  res.json(result);
});

export const getPendingActions = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new BadRequestError('Unauthorized user');
  }

  const includeExpired = parseBoolean(req.query.includeExpired, false);
  const pendingActions = await aiService.getPendingActions(userId, includeExpired);

  res.json({ pendingActions });
});

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new BadRequestError('Unauthorized user');
  }

  const limit = parseLimit(req.query.limit, 50);
  const auditLogs = await aiService.getAuditLogs(userId, limit);

  res.json({ auditLogs });
});

export const undoCommand = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new BadRequestError('Unauthorized user');
  }

  const auditLogId = typeof req.body.auditLogId === 'string' ? req.body.auditLogId : '';

  if (!auditLogId.trim()) {
    throw new BadRequestError('auditLogId is required');
  }

  const result = await aiService.undoByAuditLog(userId, auditLogId);

  res.json(result);
});