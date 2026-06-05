import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../shared/core/errors';

type NotificationSettingsInput = Partial<{
  inAppEnabled: boolean;
  telegramEnabled: boolean;
  remindDaysBefore: number;
  remindOnDueDate: boolean;
  remindOverdue: boolean;
}>;

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
    if (!settings.inAppEnabled) return;

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
      const amount = new Intl.NumberFormat('ru-RU').format(loan.monthlyPayment || 0);
      const accountText = loan.account?.name ? ` Счёт: ${loan.account.name}.` : '';

      const advanceDays = Math.max(0, Math.min(30, Number(loan.reminderDaysBefore ?? settings.remindDaysBefore ?? 1)));

      if (days === advanceDays && advanceDays > 0) {
        await this.createOnce(userId, {
          type: 'obligation_due',
          title: 'Скоро платёж',
          message: `Через ${advanceDays} дн. платёж: ${loan.title} — ${amount} ${loan.currency}.${accountText}`,
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
          message: `${loan.title}: ${amount} ${loan.currency}.${accountText}`,
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
          message: `${loan.title}: ${amount} ${loan.currency}. Проверь оплату.${accountText}`,
          severity: 'danger',
          relatedEntityType: 'obligation',
          relatedEntityId: loan.id,
          action: 'mark_obligation_paid',
          dueAt: loan.nextPaymentDate,
        });
      }
    }
  }

  private async createOnce(userId: string, input: {
    type: string;
    title: string;
    message: string;
    severity?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    action?: string;
    dueAt?: Date;
  }) {
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
}
