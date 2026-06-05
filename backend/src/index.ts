import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import cron from 'node-cron';
import { BudgetService } from './modules/budgets/service';
import { ensureProductAnalyticsSchema } from './modules/analytics/bootstrap';
import { aiCleanupService } from './modules/ai/ai-cleanup.service';
import { notificationService } from './modules/notifications/service';

async function bootstrap() {
  await ensureProductAnalyticsSchema();
  aiCleanupService.start();

  const app = createApp();

  if (env.enableCron) {
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('🔄 Checking budgets...');
        const budgetService = new BudgetService();
        await budgetService.checkAndNotifyBudgets();
        console.log('✅ Budgets checked');
      } catch (error) {
        console.error('❌ Budget cron failed:', error);
      }
    });

    cron.schedule('*/15 * * * *', async () => {
      try {
        const result = await notificationService.deliverTelegramNotifications();
        if (result.checked > 0 || result.sent > 0 || result.failed > 0) {
          console.log('🔔 Notification delivery:', result);
        }
      } catch (error) {
        console.error('❌ Notification delivery cron failed:', error);
      }
    });
  }

  const server = app.listen(env.port, () => {
    console.log(`🚀 Server running on http://localhost:${env.port}`);
    console.log(`📦 Environment: ${env.nodeEnv}`);
    console.log(`🤖 AI mode: ${env.aiMode}`);
  });

  async function shutdown(signal: string) {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch(async (error) => {
  console.error('❌ Backend bootstrap failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
