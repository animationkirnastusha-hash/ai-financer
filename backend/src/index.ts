import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import cron from 'node-cron';
import { BudgetService } from './modules/budgets/service';


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