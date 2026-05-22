import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { progressionService } from '../progression/service';

export class AIUndoService {
  async undoByAuditLog(userId: string, auditLogId: string) {
    const audit = await prisma.aIAuditLog.findFirst({ where: { id: auditLogId, userId } });
    if (!audit) throw new NotFoundError('Audit log not found');
    if (!audit.executed) throw new BadRequestError('Only executed actions can be undone');

    const parsed = this.parse(audit.parsed);
    const result = this.parse(audit.result);
    const transactionIds = this.extractTransactionIds(result);

    if (transactionIds.length === 0) {
      throw new BadRequestError('No reversible transaction found in audit result');
    }

    const undone: Array<{
      id: string;
      type: string;
      amount: number;
    }> = [];

    await prisma.$transaction(async (tx) => {
      for (const transactionId of transactionIds) {
        const transaction = await tx.transaction.findFirst({ where: { id: transactionId, userId } });
        if (!transaction) continue;

        if (transaction.type === 'income') {
          await tx.account.update({ where: { id: transaction.accountId }, data: { balance: { decrement: transaction.amount } } });
        } else if (transaction.type === 'expense') {
          await tx.account.update({ where: { id: transaction.accountId }, data: { balance: { increment: transaction.amount } } });
        } else if (transaction.type === 'transfer') {
          if (!transaction.toAccountId) continue;
          await tx.account.update({ where: { id: transaction.accountId }, data: { balance: { increment: transaction.amount } } });
          await tx.account.update({ where: { id: transaction.toAccountId }, data: { balance: { decrement: transaction.amount } } });
        }

        await tx.transaction.delete({ where: { id: transaction.id } });
        undone.push({ id: transaction.id, type: transaction.type, amount: transaction.amount });
      }
    });

    if (undone.length === 0) throw new BadRequestError('Nothing was undone');

    const progressionRollback = await progressionService.rollbackTransactionActivities(
      userId,
      undone.map((item) => item.id),
    );

    return {
      success: true,
      message: `Отменено операций: ${undone.length}`,
      auditLogId,
      parsed,
      undone,
      progressionRollback,
    };
  }

  private parse(value: string | null) {
    if (!value) return null;
    try { return JSON.parse(value) as unknown; } catch { return null; }
  }

  private extractTransactionIds(value: unknown): string[] {
    const ids = new Set<string>();

    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }

      const record = node as Record<string, unknown>;
      const transaction = record.transaction;
      if (transaction && typeof transaction === 'object' && !Array.isArray(transaction)) {
        const id = (transaction as Record<string, unknown>).id;
        if (typeof id === 'string') ids.add(id);
      }

      for (const value of Object.values(record)) walk(value);
    };

    walk(value);
    return Array.from(ids);
  }
}
