import { Prisma } from '@prisma/client';

type AccountLinkedTransaction = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  goalId: string | null;
};

export type AccountDeleteCleanupResult = {
  accountIds: string[];
  transactionIds: string[];
};

export async function cleanupAccountsBeforeDelete(
  tx: Prisma.TransactionClient,
  ownerUserId: string,
  accountIds: string[],
): Promise<AccountDeleteCleanupResult> {
  const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return { accountIds: [], transactionIds: [] };
  }

  const linkedTransactions = await tx.transaction.findMany({
    where: {
      OR: [{ accountId: { in: uniqueIds } }, { toAccountId: { in: uniqueIds } }],
    },
    select: {
      id: true,
      userId: true,
      type: true,
      amount: true,
      accountId: true,
      toAccountId: true,
      goalId: true,
    },
  });
  const transactionIds = linkedTransactions.map((item) => item.id);
  const deletedAccountIds = new Set(uniqueIds);

  for (const transaction of linkedTransactions as AccountLinkedTransaction[]) {
    if (transaction.userId !== ownerUserId || transaction.type !== 'transfer') continue;

    if (
      deletedAccountIds.has(transaction.accountId) &&
      transaction.toAccountId &&
      !deletedAccountIds.has(transaction.toAccountId)
    ) {
      await tx.account.updateMany({
        where: { userId: ownerUserId, id: transaction.toAccountId },
        data: { balance: { decrement: transaction.amount } },
      });
    }

    if (
      transaction.toAccountId &&
      deletedAccountIds.has(transaction.toAccountId) &&
      !deletedAccountIds.has(transaction.accountId)
    ) {
      await tx.account.updateMany({
        where: { userId: ownerUserId, id: transaction.accountId },
        data: { balance: { increment: transaction.amount } },
      });
    }

    if (transaction.goalId) {
      await tx.goal.updateMany({
        where: { userId: ownerUserId, id: transaction.goalId },
        data: { currentAmount: { decrement: transaction.amount } },
      });
    }
  }

  await tx.userAISettings.updateMany({
    where: {
      OR: [
        { defaultExpenseAccountId: { in: uniqueIds } },
        { defaultIncomeAccountId: { in: uniqueIds } },
      ],
    },
    data: { defaultExpenseAccountId: null, defaultIncomeAccountId: null },
  });

  await tx.financialCycleSettings.updateMany({
    where: { salaryAccountId: { in: uniqueIds } },
    data: { salaryAccountId: null },
  });

  await tx.goal.updateMany({ where: { accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.loan.updateMany({ where: { accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.loanPayment.updateMany({ where: { accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.recurringPaymentPayment.updateMany({ where: { accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.receiptScan.updateMany({ where: { accountId: { in: uniqueIds } }, data: { accountId: null } });

  if (transactionIds.length > 0) {
    await tx.loanPayment.updateMany({
      where: { transactionId: { in: transactionIds } },
      data: { transactionId: null },
    });
    await tx.recurringPaymentPayment.updateMany({
      where: { transactionId: { in: transactionIds } },
      data: { transactionId: null },
    });
    await tx.receiptScan.updateMany({
      where: { transactionId: { in: transactionIds } },
      data: { transactionId: null },
    });
    await tx.transaction.updateMany({
      where: { sourceTransactionId: { in: transactionIds } },
      data: { sourceTransactionId: null },
    });
    await tx.transaction.deleteMany({ where: { id: { in: transactionIds } } });
  }

  await tx.spendingLimit.deleteMany({ where: { accountId: { in: uniqueIds } } });
  await tx.recurringPayment.deleteMany({ where: { accountId: { in: uniqueIds } } });

  return { accountIds: uniqueIds, transactionIds };
}
