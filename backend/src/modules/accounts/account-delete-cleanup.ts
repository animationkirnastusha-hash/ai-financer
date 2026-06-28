import { Prisma } from '@prisma/client';

type AccountTransferTransaction = {
  id: string;
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
  userId: string,
  accountIds: string[],
): Promise<AccountDeleteCleanupResult> {
  const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return { accountIds: [], transactionIds: [] };
  }

  const linkedTransactions = await tx.transaction.findMany({
    where: {
      userId,
      OR: [{ accountId: { in: uniqueIds } }, { toAccountId: { in: uniqueIds } }],
    },
    select: { id: true, type: true, amount: true, accountId: true, toAccountId: true, goalId: true },
  });
  const transactionIds = linkedTransactions.map((item) => item.id);
  const deletedAccountIds = new Set(uniqueIds);

  for (const transaction of linkedTransactions as AccountTransferTransaction[]) {
    if (transaction.type !== 'transfer') continue;

    if (
      deletedAccountIds.has(transaction.accountId) &&
      transaction.toAccountId &&
      !deletedAccountIds.has(transaction.toAccountId)
    ) {
      await tx.account.updateMany({
        where: { userId, id: transaction.toAccountId },
        data: { balance: { decrement: transaction.amount } },
      });
    }

    if (
      transaction.toAccountId &&
      deletedAccountIds.has(transaction.toAccountId) &&
      !deletedAccountIds.has(transaction.accountId)
    ) {
      await tx.account.updateMany({
        where: { userId, id: transaction.accountId },
        data: { balance: { increment: transaction.amount } },
      });
    }

    if (transaction.goalId) {
      await tx.goal.updateMany({
        where: { userId, id: transaction.goalId },
        data: { currentAmount: { decrement: transaction.amount } },
      });
    }
  }

  await tx.userAISettings.updateMany({
    where: {
      userId,
      OR: [
        { defaultExpenseAccountId: { in: uniqueIds } },
        { defaultIncomeAccountId: { in: uniqueIds } },
      ],
    },
    data: { defaultExpenseAccountId: null, defaultIncomeAccountId: null },
  });

  await tx.financialCycleSettings.updateMany({
    where: { userId, salaryAccountId: { in: uniqueIds } },
    data: { salaryAccountId: null },
  });

  await tx.goal.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.loan.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.loanPayment.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.recurringPaymentPayment.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });
  await tx.receiptScan.updateMany({ where: { userId, accountId: { in: uniqueIds } }, data: { accountId: null } });

  if (transactionIds.length > 0) {
    await tx.loanPayment.updateMany({
      where: { userId, transactionId: { in: transactionIds } },
      data: { transactionId: null },
    });
    await tx.recurringPaymentPayment.updateMany({
      where: { userId, transactionId: { in: transactionIds } },
      data: { transactionId: null },
    });
    await tx.receiptScan.updateMany({
      where: { userId, transactionId: { in: transactionIds } },
      data: { transactionId: null },
    });
    await tx.transaction.updateMany({
      where: { userId, sourceTransactionId: { in: transactionIds } },
      data: { sourceTransactionId: null },
    });
    await tx.transaction.deleteMany({
      where: {
        userId,
        OR: [{ accountId: { in: uniqueIds } }, { toAccountId: { in: uniqueIds } }],
      },
    });
  }

  await tx.spendingLimit.deleteMany({ where: { userId, accountId: { in: uniqueIds } } });
  await tx.recurringPayment.deleteMany({ where: { userId, accountId: { in: uniqueIds } } });

  return { accountIds: uniqueIds, transactionIds };
}
