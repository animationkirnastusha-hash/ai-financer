import { prisma } from '../../lib/prisma';
import { AIMemoryService } from './ai-memory.service';

export class AIContextService {
  private readonly memory = new AIMemoryService();

  async buildUserContext(userId: string) {
    const [accounts, categories, sections, goals, obligations, obligationReminders, recentTransactions, aiSettings, onboardingState, aiSessionState] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true, type: true, currency: true, balance: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.category.findMany({
        where: { userId },
        select: { id: true, name: true, type: true, sectionId: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.section.findMany({
        where: { userId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.goal.findMany({
        where: { userId },
        select: { id: true, title: true, targetAmount: true, currentAmount: true, currency: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.loan.findMany({
        where: { userId },
        select: { id: true, title: true, type: true, monthlyPayment: true, currentDebt: true, currency: true, status: true, nextPaymentDate: true, account: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { nextPaymentDate: 'asc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      prisma.obligationReminder.findMany({
        where: { userId, status: { in: ['scheduled', 'sent'] } },
        select: { id: true, title: true, dueDate: true, remindAt: true, status: true, loan: { select: { id: true, title: true } } },
        orderBy: { remindAt: 'asc' },
        take: 10,
      }),
      prisma.transaction.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          account: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true, type: true } },
          section: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      prisma.userAISettings.findUnique({ where: { userId } }),
      prisma.onboardingState.findUnique({ where: { userId } }),
      prisma.aISessionState.findUnique({ where: { userId } }),
    ]);

    const memory = await this.memory.buildUserMemory(userId, { accounts });

    return { accounts, categories, sections, goals, obligations, obligationReminders, recentTransactions, memory, aiSettings, onboardingState, aiSessionState };
  }
}
