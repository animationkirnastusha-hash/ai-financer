import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { TransactionService } from '../transactions/service';
import { AccountService } from '../accounts/service';
import { CategoryService } from '../categories/service';
import { SectionService } from '../sections/service';
import { AIAuditService } from './audit.service';

const transactionService = new TransactionService();
const accountService = new AccountService();
const categoryService = new CategoryService();
const sectionService = new SectionService();
const auditService = new AIAuditService();

type UndoStepResult = {
  intent: string;
  targetId?: string;
  status: 'undone' | 'skipped';
  message: string;
  data?: unknown;
};

function safeParseJson(value: string | null): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readId(value: unknown) {
  const record = asRecord(value);
  const directId = record?.id;
  const data = asRecord(record?.data);
  const nestedId = data?.id;

  if (typeof directId === 'string' && directId.trim()) return directId;
  if (typeof nestedId === 'string' && nestedId.trim()) return nestedId;

  return undefined;
}

function readIntent(value: unknown, fallback = 'unknown') {
  const record = asRecord(value);
  const intent = record?.intent;
  return typeof intent === 'string' && intent.trim() ? intent : fallback;
}

function readBatchItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  const data = record?.data;
  if (Array.isArray(data)) return data;

  const results = record?.results;
  if (Array.isArray(results)) return results;

  return [];
}

export class AIUndoService {
  async undoByAuditLog(userId: string, auditLogId: string) {
    const auditLog = await prisma.aIAuditLog.findFirst({
      where: {
        id: auditLogId,
        userId,
      },
    });

    if (!auditLog) throw new NotFoundError('AI audit log not found');
    if (!auditLog.executed) throw new BadRequestError('Only executed AI actions can be undone');
    if (auditLog.status === 'undone') throw new BadRequestError('AI action already undone');

    const parsed = safeParseJson(auditLog.parsed);
    const result = safeParseJson(auditLog.result);
    const steps = await this.undoResult(userId, auditLog.intent, result);
    const undoneCount = steps.filter((step) => step.status === 'undone').length;

    if (undoneCount === 0) {
      throw new BadRequestError('Для этого AI-действия пока нет безопасного отката');
    }

    await prisma.aIAuditLog.update({
      where: { id: auditLog.id },
      data: { status: 'undone' },
    });

    const undoLog = await auditService.createLog({
      userId,
      command: `UNDO:${auditLog.command}`,
      intent: auditLog.intent,
      riskLevel: auditLog.riskLevel,
      requiresConfirmation: false,
      executed: true,
      status: 'undone',
      parsed: asRecord(parsed),
      result: { steps, undoneCount },
    });

    return {
      success: true,
      message:
        undoneCount === 1
          ? '↩️ AI-действие отменено.'
          : `↩️ AI-действия отменены: ${undoneCount}.`,
      undoneAuditLogId: auditLog.id,
      undoAuditLogId: undoLog.id,
      steps,
    };
  }

  private async undoResult(userId: string, intent: string, result: unknown): Promise<UndoStepResult[]> {
    if (intent === 'batch') {
      const items = readBatchItems(result);
      const steps: UndoStepResult[] = [];

      for (const item of [...items].reverse()) {
        const itemIntent = readIntent(item);
        const record = asRecord(item);
        const itemResult = record?.data ?? item;
        steps.push(...(await this.undoResult(userId, itemIntent, itemResult)));
      }

      return steps;
    }

    const id = readId(result);
    if (!id) {
      return [{ intent, status: 'skipped', message: 'Не найден объект для отката' }];
    }

    if (intent === 'expense' || intent === 'income' || intent === 'transfer') {
      const data = await transactionService.deleteTransaction(userId, id);
      return [{ intent, targetId: id, status: 'undone', message: 'Операция удалена', data }];
    }

    if (intent === 'create_account') {
      const data = await accountService.deleteAccount(userId, id);
      return [{ intent, targetId: id, status: 'undone', message: 'Счёт удалён', data }];
    }

    if (intent === 'create_category') {
      const data = await categoryService.deleteCategory(userId, id);
      return [{ intent, targetId: id, status: 'undone', message: 'Категория удалена', data }];
    }

    if (intent === 'create_section') {
      const data = await sectionService.deleteSection(userId, id);
      return [{ intent, targetId: id, status: 'undone', message: 'Раздел удалён', data }];
    }

    return [{ intent, targetId: id, status: 'skipped', message: 'Для действия нет безопасного отката' }];
  }
}
