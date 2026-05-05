import { prisma } from '../../lib/prisma';

export class RepeatCommandService {
  async getLastTransaction(userId: string) {
    return prisma.transaction.findFirst({
      where: { userId },
      include: { category: true, account: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}