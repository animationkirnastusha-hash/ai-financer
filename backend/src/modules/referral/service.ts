import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

function makeReferralCode(seed: string) {
  const base = seed.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase() || 'AIFIN';
  return `AI${base}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export class ReferralService {
  async ensureReferralCode(userId: string) {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, referralCode: true, telegramId: true } });
    if (!existing) throw new NotFoundError('User not found');
    if (existing.referralCode) return existing.referralCode;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = makeReferralCode(existing.telegramId.toString());
      try {
        const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: code }, select: { referralCode: true } });
        return updated.referralCode!;
      } catch {
        // retry unique collision
      }
    }

    throw new BadRequestError('Could not create referral code');
  }

  async getReferralInfo(userId: string) {
    await this.ensureReferralCode(userId);

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

  async applyReferralCode(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) throw new BadRequestError('Referral code is required');

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, referrerId: true, referralCode: true } });
    if (!user) throw new NotFoundError('User not found');
    if (user.referrerId) throw new BadRequestError('Referral code already applied');
    if (user.referralCode?.toUpperCase() === code) throw new BadRequestError('You cannot use your own referral code');

    const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!referrer) throw new NotFoundError('Referral code not found');

    await prisma.user.update({ where: { id: userId }, data: { referrerId: referrer.id } });

    return this.getReferralInfo(userId);
  }
}
