import { prisma } from '../../lib/prisma';

export class AIContextService {
  async buildUserContext(userId: string) {
    const [accounts, categories, sections] = await Promise.all([
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
    ]);

    return { accounts, categories, sections };
  }
}
