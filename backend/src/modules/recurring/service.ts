import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export interface CreateRecurringPaymentInput {
  name: string;
  amount: number;
  category: string;
  period: string;
  accountId: string;
  nextDate?: Date;
  isActive?: boolean;
}

export interface UpdateRecurringPaymentInput {
  name?: string;
  amount?: number;
  category?: string;
  period?: string;
  accountId?: string;
  nextDate?: Date;
  isActive?: boolean;
}

export class RecurringService {
  async getRecurringPayments(userId: string) {
    return prisma.recurringPayment.findMany({
      where: { userId },
      include: {
        account: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getRecurringPaymentById(userId: string, recurringId: string) {
    const recurringPayment = await prisma.recurringPayment.findFirst({
      where: { id: recurringId, userId },
      include: {
        account: true,
      },
    });

    if (!recurringPayment) {
      throw new NotFoundError('Recurring payment not found');
    }

    return recurringPayment;
  }

  async createRecurringPayment(userId: string, input: CreateRecurringPaymentInput) {
    if (!input.name?.trim()) {
      throw new BadRequestError('name is required');
    }

    if (!input.category?.trim()) {
      throw new BadRequestError('category is required');
    }

    if (!input.period?.trim()) {
      throw new BadRequestError('period is required');
    }

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError('amount must be greater than 0');
    }

    const account = await prisma.account.findFirst({
      where: {
        id: input.accountId,
        userId,
      },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return prisma.recurringPayment.create({
      data: {
        userId,
        accountId: input.accountId,
        name: input.name.trim(),
        amount,
        category: input.category.trim(),
        period: input.period.trim(),
        nextDate: input.nextDate ?? new Date(),
        isActive: input.isActive ?? true,
      },
      include: {
        account: true,
      },
    });
  }

  async updateRecurringPayment(userId: string, recurringId: string, input: UpdateRecurringPaymentInput) {
    const existing = await prisma.recurringPayment.findFirst({
      where: { id: recurringId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Recurring payment not found');
    }

    if (input.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: input.accountId,
          userId,
        },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }
    }

    const amount =
      input.amount !== undefined ? Number(input.amount) : undefined;

    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      throw new BadRequestError('amount must be greater than 0');
    }

    return prisma.recurringPayment.update({
      where: { id: recurringId },
      data: {
        name: input.name?.trim(),
        amount,
        category: input.category?.trim(),
        period: input.period?.trim(),
        accountId: input.accountId,
        nextDate: input.nextDate,
        isActive: input.isActive,
      },
      include: {
        account: true,
      },
    });
  }

  async deleteRecurringPayment(userId: string, recurringId: string) {
    const existing = await prisma.recurringPayment.findFirst({
      where: { id: recurringId, userId },
      include: {
        account: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Recurring payment not found');
    }

    await prisma.recurringPayment.delete({
      where: { id: recurringId },
    });

    return existing;
  }
}