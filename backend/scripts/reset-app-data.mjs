import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mode = process.env.RESET_MODE === 'full' ? 'full' : 'finance';
const userId = process.env.RESET_USER_ID || null;
const allUsers = process.env.RESET_ALL_USERS === '1' || process.env.RESET_ALL_USERS === 'true';
const confirmed = process.env.RESET_CONFIRM === 'RESET';

if (!confirmed) {
  console.error('Reset cancelled. Set RESET_CONFIRM=RESET to run.');
  process.exit(1);
}

if (!allUsers && !userId) {
  console.error('Set RESET_USER_ID=<id> or RESET_ALL_USERS=1.');
  process.exit(1);
}

const byUser = allUsers ? {} : { userId };
const byId = allUsers ? {} : { id: userId };
const deleted = {};
const updated = {};

async function del(label, action) {
  const result = await action();
  deleted[label] = result.count;
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await del('aiPendingActions', () => tx.aIPendingAction.deleteMany({ where: byUser }));
    await del('aiAuditLogs', () => tx.aIAuditLog.deleteMany({ where: byUser }));
    await del('aiMessages', () => tx.aIMessage.deleteMany({ where: byUser }));
    await del('aiTrainingExamples', () => tx.aITrainingExample.deleteMany({ where: byUser }));
    await del('aiSessionState', () => tx.aISessionState.deleteMany({ where: byUser }));
    await del('aiIdempotencyRecords', () => tx.aIIdempotencyRecord.deleteMany({ where: byUser }));
    await del('aiOperationEvents', () => tx.aIOperationEvent.deleteMany({ where: byUser }));

    await del('notifications', () => tx.notification.deleteMany({ where: byUser }));
    await del('recurringPayments', () => tx.recurringPayment.deleteMany({ where: byUser }));
    await del('budgets', () => tx.budget.deleteMany({ where: byUser }));
    await del('transactions', () => tx.transaction.deleteMany({ where: byUser }));
    await del('goals', () => tx.goal.deleteMany({ where: byUser }));
    await del('categories', () => tx.category.deleteMany({ where: byUser }));
    await del('sections', () => tx.section.deleteMany({ where: byUser }));
    await del('accounts', () => tx.account.deleteMany({ where: byUser }));

    if (mode === 'full') {
      await del('userAchievements', () => tx.userAchievement.deleteMany({ where: byUser }));
      await del('userActivities', () => tx.userActivity.deleteMany({ where: byUser }));
      await del('progressionProfiles', () => tx.progressionProfile.deleteMany({ where: byUser }));
      await del('companionEvents', () => tx.aICompanionEvent.deleteMany({ where: byUser }));
      await del('aiSettings', () => tx.userAISettings.deleteMany({ where: byUser }));
      await del('onboardingState', () => tx.onboardingState.deleteMany({ where: byUser }));
      await del('premiumCapabilities', () => tx.aIPremiumCapability.deleteMany({ where: byUser }));

      const result = await tx.user.updateMany({
        where: byId,
        data: {
          balance: 0,
          xp: 0,
          level: 1,
          streakDays: 0,
          referralBalance: 0,
          voiceLimit: 5,
          lastActiveAt: null,
        },
      });
      updated.users = result.count;
    }
  }, { timeout: 30000 });

  console.log(JSON.stringify({ success: true, mode, scope: allUsers ? 'all' : 'single', userId, deleted, updated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
