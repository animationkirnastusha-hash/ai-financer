import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../shared/core/errors';

export class ReferralService {
  async getReferralInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        referralCode: true,
        referralBalance: true,
        referrer: {
          select: {
            id: true,
            firstName: true,
            username: true,
          },
        },
        referrals: {
          select: {
            id: true,
            firstName: true,
            username: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const referralTransactions = await prisma.referralTransaction.findMany({
      where: {
        userId,
      },
      include: {
        fromUser: {
          select: {
            id: true,
            firstName: true,
            username: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      referralCode: user.referralCode,
      referralBalance: user.referralBalance,
      referrer: user.referrer,
      referrals: user.referrals,
      referralTransactions,
    };
  }
}