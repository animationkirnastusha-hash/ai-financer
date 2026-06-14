import { Prisma } from '@prisma/client';

export type GoalAutoSaveIncomeInput = {
  incomeTransactionId: string;
  incomeAccountId: string;
  incomeAmount: number;
  currency: string;
  date: Date;
};

export class GoalAutoSaveService {
  async applyForIncome(
    tx: Prisma.TransactionClient,
    userId: string,
    input: GoalAutoSaveIncomeInput,
  ) {
    if (!input.incomeAmount || input.incomeAmount <= 0) return [];

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
          description: `Автопополнение цели из дохода`,
          date: input.date,
          isAIGenerated: true,
        },
        select: { id: true },
      });

      createdTransfers.push({ transactionId: transfer.id, goalId: goal.id, amount });
    }

    return createdTransfers;
  }
}

export const goalAutoSaveService = new GoalAutoSaveService();
