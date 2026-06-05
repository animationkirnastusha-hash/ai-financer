import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { NotFoundError } from '../../shared/core/errors';

type NotificationSettingsInput = Partial<{
  inAppEnabled: boolean;
  telegramEnabled: boolean;
  remindDaysBefore: number;
  remindOnDueDate: boolean;
  remindOverdue: boolean;
}>;

type CreateNotificationInput = {
  type: string;
  title: string;
  message: string;
  severity?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  action?: string;
  dueAt?: Date;
};

function startOfLocalDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / 86400000);
}

function normalizeReminderDays(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0, Math.min(30, Math.round(numeric)));
}

function formatMoney(amount: number, currency: string) {
  const formatted = new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(amount || 0)));
  return `${formatted} ${currency || 'RUB'}`;
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveTelegramOpenUrl() {
  const raw = (process.env.TELEGRAM_WEB_APP_URL || env.frontendUrl || '').trim();
  return raw || undefined;
}

function shouldDeliverToTelegram(type: string) {
  return ['obligation_due', 'obligation_due_today', 'obligation_overdue', 'payment_marked'].includes(type);
}

export class NotificationService {
  async getSettings(userId: string) {
    return prisma.notificationSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateSettings(userId: string, input: NotificationSettingsInput) {
    const data: NotificationSettingsInput = {};

    if (typeof input.inAppEnabled === 'boolean') data.inAppEnabled = input.inAppEnabled;
    if (typeof input.telegramEnabled === 'boolean') data.telegramEnabled = input.telegramEnabled;
    if (typeof input.remindOnDueDate === 'boolean') data.remindOnDueDate = input.remindOnDueDate;
    if (typeof input.remindOverdue === 'boolean') data.remindOverdue = input.remindOverdue;
    if (input.remindDaysBefore !== undefined) data.remindDaysBefore = normalizeReminderDays(input.remindDaysBefore);

    return prisma.notificationSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        inAppEnabled: data.inAppEnabled ?? true,
        telegramEnabled: data.telegramEnabled ?? true,
        remindDaysBefore: data.remindDaysBefore ?? 1,
        remindOnDueDate: data.remindOnDueDate ?? true,
        remindOverdue: data.remindOverdue ?? true,
      },
    });
  }

  async syncObligationNotifications(userId: string) {
    const settings = await this.getSettings(userId);
    if (!settings.inAppEnabled && !settings.telegramEnabled) return;

    const today = new Date();
    const loans = await prisma.loan.findMany({
      where: {
        userId,
        status: 'active',
        nextPaymentDate: { not: null },
      },
      include: { account: true },
      orderBy: { nextPaymentDate: 'asc' },
    });

    for (const loan of loans) {
      if (!loan.nextPaymentDate) continue;
      const days = daysBetween(today, loan.nextPaymentDate);
      const accountText = loan.account?.name ? ` Счёт: ${loan.account.name}.` : '';
      const amount = formatMoney(loan.monthlyPayment, loan.currency);
      const advanceDays = Math.max(0, Math.min(30, Number(loan.reminderDaysBefore ?? settings.remindDaysBefore ?? 1)));

      if (days === advanceDays && advanceDays > 0) {
        await this.createOnce(userId, {
          type: 'obligation_due',
          title: 'Скоро платёж',
          message: `Через ${advanceDays} дн. платёж: ${loan.title} — ${amount}.${accountText}`,
          severity: 'info',
          relatedEntityType: 'obligation',
          relatedEntityId: loan.id,
          action: 'open_obligation',
          dueAt: loan.nextPaymentDate,
        });
      }

      if (days === 0 && settings.remindOnDueDate) {
        await this.createOnce(userId, {
          type: 'obligation_due_today',
          title: 'Сегодня платёж',
          message: `${loan.title}: ${amount}.${accountText}`,
          severity: 'warning',
          relatedEntityType: 'obligation',
          relatedEntityId: loan.id,
          action: 'mark_obligation_paid',
          dueAt: loan.nextPaymentDate,
        });
      }

      if (days < 0 && settings.remindOverdue) {
        await this.createOnce(userId, {
          type: 'obligation_overdue',
          title: 'Платёж просрочен',
          message: `${loan.title}: ${amount}. Проверь оплату.${accountText}`,
          severity: 'danger',
          relatedEntityType: 'obligation',
          relatedEntityId: loan.id,
          action: 'mark_obligation_paid',
          dueAt: loan.nextPaymentDate,
        });
      }
    }
  }

  async syncObligationNotificationsForAllUsers() {
    const rows = await prisma.loan.findMany({
      where: {
        status: 'active',
        nextPaymentDate: { not: null },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    let users = 0;
    for (const row of rows) {
      await this.syncObligationNotifications(row.userId);
      users += 1;
    }

    return { users };
  }

  private async createOnce(userId: string, input: CreateNotificationInput) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: input.type,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        dueAt: input.dueAt ?? null,
      },
      select: { id: true },
    });

    if (existing) return existing;

    return prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        severity: input.severity ?? 'info',
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        action: input.action,
        dueAt: input.dueAt,
      },
    });
  }

  async getUserNotifications(userId: string) {
    await this.syncObligationNotifications(userId);

    return prisma.notification.findMany({
      where: {
        userId,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 80,
    });
  }

  async getUnreadCount(userId: string) {
    await this.syncObligationNotifications(userId);

    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
        archivedAt: null,
      },
    });

    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        archivedAt: null,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { archivedAt: new Date() },
    });

    return notification;
  }

  async deliverTelegramNotifications() {
    if (!env.telegramBotToken) {
      return { checked: 0, sent: 0, failed: 0, skipped: 0, reason: 'TELEGRAM_BOT_TOKEN_MISSING' };
    }

    await this.syncObligationNotificationsForAllUsers();

    const notifications = await prisma.notification.findMany({
      where: {
        archivedAt: null,
        type: { in: ['obligation_due', 'obligation_due_today', 'obligation_overdue', 'payment_marked'] },
        deliveries: {
          none: {
            channel: 'telegram',
            status: 'sent',
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            notificationSettings: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const notification of notifications) {
      const settings = notification.user.notificationSettings;
      const telegramEnabled = settings?.telegramEnabled ?? true;
      const chatId = notification.user.telegramId?.toString();

      if (!telegramEnabled || !chatId || !shouldDeliverToTelegram(notification.type)) {
        skipped += 1;
        await this.upsertDelivery(notification.id, notification.userId, 'skipped', 'telegram disabled or no chat id');
        continue;
      }

      const result = await this.sendTelegramMessage(chatId, notification.title, notification.message, notification.severity || 'info');

      if (result.ok) {
        sent += 1;
        await this.upsertDelivery(notification.id, notification.userId, 'sent', undefined, result.messageId);
      } else {
        failed += 1;
        await this.upsertDelivery(notification.id, notification.userId, 'failed', result.error || 'Telegram send failed');
      }
    }

    return { checked: notifications.length, sent, failed, skipped };
  }

  private async upsertDelivery(notificationId: string, userId: string, status: 'sent' | 'failed' | 'skipped', error?: string, externalId?: string) {
    const now = new Date();

    return prisma.notificationDelivery.upsert({
      where: {
        notificationId_channel: {
          notificationId,
          channel: 'telegram',
        },
      },
      update: {
        status,
        sentAt: status === 'sent' ? now : undefined,
        failedAt: status === 'failed' ? now : undefined,
        lastError: error,
        externalId,
        attemptCount: { increment: 1 },
      },
      create: {
        notificationId,
        userId,
        channel: 'telegram',
        status,
        sentAt: status === 'sent' ? now : undefined,
        failedAt: status === 'failed' ? now : undefined,
        lastError: error,
        externalId,
        attemptCount: 1,
      },
    });
  }

  private async sendTelegramMessage(chatId: string, title: string, message: string, severity: string) {
    const icon = severity === 'danger' ? '⚠️' : severity === 'warning' ? '⏰' : '🔔';
    const text = `${icon} <b>${escapeTelegramHtml(title)}</b>\n\n${escapeTelegramHtml(message)}`;
    const openUrl = resolveTelegramOpenUrl();
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (openUrl) {
      body.reply_markup = {
        inline_keyboard: [[{ text: 'Открыть Фину', url: openUrl }]],
      };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number }; description?: string } | null;

      if (!response.ok || !payload?.ok) {
        return { ok: false, error: payload?.description || `Telegram HTTP ${response.status}` };
      }

      return { ok: true, messageId: payload.result?.message_id ? String(payload.result.message_id) : undefined };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Telegram request failed' };
    }
  }
}

export const notificationService = new NotificationService();
