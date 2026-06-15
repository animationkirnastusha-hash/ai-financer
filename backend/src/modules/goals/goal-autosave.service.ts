import { Prisma } from '@prisma/client';

export type GoalAutoSaveIncomeInput = {
  incomeTransactionId: string;
  incomeAccountId: string;
  incomeAmount: number;
  currency: string;
  date: Date;
};

export type LinkedGoalTransfer = {
  id: string;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  goalId: string | null;
  sourceTransactionId: string | null;
};

export class GoalAutoSaveService {
  async applyForIncome(
    tx: Prisma.TransactionClient,
    userId: string,
    input: GoalAutoSaveIncomeInput,
  ) {
    if (!input.incomeAmount || input.incomeAmount <= 0) return [];

    const alreadyCreated = await tx.transaction.count({
      where: {
        userId,
        type: 'transfer',
        sourceTransactionId: input.incomeTransactionId,
      },
    });

    if (alreadyCreated > 0) return [];

    const goals = await tx.goal.findMany({
      where: {
        userId,
        status: 'active',
        currency: input.currency,
        accountId: { not: null },
        autoSavePercent: { gt: 0 },
      },
      select: {
        id: true,
        title: true,
        targetAmount: true,
        currentAmount: true,
        accountId: true,
        autoSavePercent: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const createdTransfers: Array<{ transactionId: string; goalId: string; amount: number }> = [];

    for (const goal of goals) {
      if (!goal.accountId || goal.accountId === input.incomeAccountId) continue;

      const amountByPercent = Math.floor((input.incomeAmount * goal.autoSavePercent) / 100);
      const amountLeft = Math.max(goal.targetAmount - goal.currentAmount, 0);
      const amount = Math.min(amountByPercent, amountLeft);
      if (amount <= 0) continue;

      const debit = await tx.account.updateMany({
        where: {
          id: input.incomeAccountId,
          userId,
          balance: { gte: amount },
        },
        data: { balance: { decrement: amount } },
      });

      if (debit.count !== 1) continue;

      await tx.account.update({
        where: { id: goal.accountId },
        data: { balance: { increment: amount } },
      });

      const nextCurrentAmount = goal.currentAmount + amount;
      await tx.goal.update({
        where: { id: goal.id },
        data: {
          currentAmount: nextCurrentAmount,
          status: nextCurrentAmount >= goal.targetAmount ? 'completed' : 'active',
        },
      });

      const transfer = await tx.transaction.create({
        data: {
          userId,
          accountId: input.incomeAccountId,
          toAccountId: goal.accountId,
          amount,
          type: 'transfer',
          title: `В цель: ${goal.title}`,
          description: 'Автопополнение цели из дохода',
          date: input.date,
          isAIGenerated: true,
          sourceTransactionId: input.incomeTransactionId,
          goalId: goal.id,
        },
        select: { id: true },
      });

      createdTransfers.push({ transactionId: transfer.id, goalId: goal.id, amount });
    }

    return createdTransfers;
  }

  async removeForIncome(
    tx: Prisma.TransactionClient,
    userId: string,
    incomeTransactionId: string,
    options: { revertBalances: boolean },
  ) {
    const transfers = await tx.transaction.findMany({
      where: {
        userId,
        type: 'transfer',
        sourceTransactionId: incomeTransactionId,
      },
      select: {
        id: true,
        amount: true,
        accountId: true,
        toAccountId: true,
        goalId: true,
        sourceTransactionId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const transfer of transfers) {
      if (options.revertBalances) {
        await this.revertLinkedTransferBalance(tx, transfer);
        await this.decrementGoalProgress(tx, userId, transfer.goalId, transfer.amount);
      }

      await tx.transaction.delete({ where: { id: transfer.id } });
    }

    return transfers;
  }

  async handleLinkedTransferDeleted(
    tx: Prisma.TransactionClient,
    userId: string,
    transfer: LinkedGoalTransfer,
    options: { balanceMode: 'revert' | 'keep' },
  ) {
    if (!transfer.goalId || !transfer.sourceTransactionId) return;
    if (options.balanceMode !== 'revert') return;
    await this.decrementGoalProgress(tx, userId, transfer.goalId, transfer.amount);
  }

  private async revertLinkedTransferBalance(
    tx: Prisma.TransactionClient,
    transfer: LinkedGoalTransfer,
  ) {
    await tx.account.update({
      where: { id: transfer.accountId },
      data: { balance: { increment: transfer.amount } },
    });

    if (transfer.toAccountId) {
      await tx.account.update({
        where: { id: transfer.toAccountId },
        data: { balance: { decrement: transfer.amount } },
      });
    }
  }

  private async decrementGoalProgress(
    tx: Prisma.TransactionClient,
    userId: string,
    goalId: string | null,
    amount: number,
  ) {
    if (!goalId || amount <= 0) return;

    const goal = await tx.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true, currentAmount: true, targetAmount: true },
    });

    if (!goal) return;

    const currentAmount = Math.max(0, goal.currentAmount - amount);
    await tx.goal.update({
      where: { id: goal.id },
      data: {
        currentAmount,
        status: currentAmount >= goal.targetAmount ? 'completed' : 'active',
      },
    });
  }
}

export const goalAutoSaveService = new GoalAutoSaveService();
