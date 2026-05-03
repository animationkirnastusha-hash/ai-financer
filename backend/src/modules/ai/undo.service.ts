import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { TransactionService } from '../transactions/service';
import { AIAuditService } from './audit.service';

const transactionService = new TransactionService();
const auditService = new AIAuditService();

function safeParseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export class AIUndoService {
  async undoByAuditLog(userId: string, auditLogId: string) {
    const auditLog = await prisma.aIAuditLog.findFirst({
      where: {
        id: auditLogId,
        userId,
      },
    });

    if (!auditLog) {
      throw new NotFoundError('AI audit log not found');
    }

    if (!auditLog.executed) {
      throw new BadRequestError('Only executed AI actions can be undone');
    }

    if (auditLog.status === 'undone') {
      throw new BadRequestError('AI action already undone');
    }

    const result = safeParseObject(auditLog.result);

    if (!result?.id || typeof result.id !== 'string') {
      throw new BadRequestError('Undo target not found in audit log');
    }

    if (
      auditLog.intent !== 'expense' &&
      auditLog.intent !== 'income' &&
      auditLog.intent !== 'transfer'
    ) {
      throw new BadRequestError('Undo is currently available only for AI-created transactions');
    }

    const deletedTransaction = await transactionService.deleteTransaction(userId, result.id);

    await prisma.aIAuditLog.update({
      where: { id: auditLog.id },
      data: {
        status: 'undone',
      },
    });

    const undoLog = await auditService.createLog({
      userId,
      command: `UNDO:${auditLog.command}`,
      intent: auditLog.intent,
      riskLevel: auditLog.riskLevel,
      requiresConfirmation: false,
      executed: true,
      status: 'undone',
      parsed: safeParseObject(auditLog.parsed),
      result: deletedTransaction,
    });

    return {
      success: true,
      message: '↩️ AI-действие отменено.',
      undoneAuditLogId: auditLog.id,
      undoAuditLogId: undoLog.id,
      transaction: deletedTransaction,
    };
  }
}