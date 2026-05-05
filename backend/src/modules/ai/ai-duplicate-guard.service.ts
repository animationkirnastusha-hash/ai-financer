import { prisma } from '../../lib/prisma';

export class AIDuplicateGuardService {
  async isDuplicate(userId: string, amount: number) {
    const recent = await prisma.transaction.findFirst({
      where: {
        userId,
        amount,
        createdAt: {
          gte: new Date(Date.now() - 8000),
        },
      },
    });

    return !!recent;
  }
}