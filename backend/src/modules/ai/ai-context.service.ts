import { prisma } from '../../lib/prisma';

export class AIContextService {
  async buildUserContext(userId: string) {
    const [accounts, categories, sections, recentTransactions] = await Promise.all([
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
    ]);

    return { accounts, categories, sections, recentTransactions };
  }
}
