import type { ReceiptScan } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import { subscriptionService } from '../subscription/service';
import { TransactionService } from '../transactions/service';

export type ReceiptScanDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  merchant: string | null;
  totalAmount: number | null;
  currency: string;
  purchasedAt: string | null;
  preview: ReceiptScanPreview | null;
  createdAt: string;
  updatedAt: string;
};

type ReceiptScanPreview = {
  title: string;
  caption: string;
  fields: Array<{ label: string; value: string }>;
};

type CreateReceiptInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type ReviewReceiptInput = Partial<{
  merchant: unknown;
  totalAmount: unknown;
  currency: unknown;
  purchasedAt: unknown;
  rawText: unknown;
}>;

type CreateExpenseFromReceiptInput = Partial<{
  accountId: unknown;
  categoryId: unknown;
  sectionId: unknown;
  amount: unknown;
  title: unknown;
  description: unknown;
  date: unknown;
}>;

const MAX_RECEIPT_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function normalizeFileName(value: string): string {
  return value.replace(/[\\/\0]/g, '').trim().slice(0, 120) || 'receipt';
}

function parsePreview(value: string | null): ReceiptScanPreview | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as ReceiptScanPreview;
  } catch {
    return null;
  }
}

function normalizeOptionalString(value: unknown, maxLength = 180): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new BadRequestError('Invalid text value');
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeMoney(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new BadRequestError('Invalid receipt amount');
  return Math.round(numeric);
}

function normalizeCurrency(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new BadRequestError('Invalid currency');
  const currency = value.trim().toUpperCase().slice(0, 8);
  return currency || undefined;
}

function normalizeDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestError('Invalid date');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid date');
  return date;
}

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestError(`${field} is required`);
  return value.trim();
}

function formatMoney(amount: number | null | undefined, currency: string) {
  if (typeof amount !== 'number') return '—';
  return `${new Intl.NumberFormat('ru-RU').format(amount)} ${currency || 'RUB'}`;
}

function toDto(scan: ReceiptScan): ReceiptScanDto {
  return {
    id: scan.id,
    fileName: scan.fileName,
    mimeType: scan.mimeType,
    sizeBytes: scan.sizeBytes,
    status: scan.status,
    merchant: scan.merchant,
    totalAmount: scan.totalAmount,
    currency: scan.currency,
    purchasedAt: scan.purchasedAt?.toISOString() ?? null,
    preview: parsePreview(scan.preview),
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}

function buildPreview(input: CreateReceiptInput): ReceiptScanPreview {
  const kb = Math.max(1, Math.round(input.sizeBytes / 1024));
  return {
    title: 'Чек загружен',
    caption: 'Проверь чек и создай расход, когда данные готовы.',
    fields: [
      { label: 'Файл', value: input.fileName },
      { label: 'Размер', value: `${kb} КБ` },
      { label: 'Статус', value: 'Ожидает проверки' },
    ],
  };
}

function buildReviewedPreview(scan: Pick<ReceiptScan, 'merchant' | 'totalAmount' | 'currency' | 'purchasedAt'>): ReceiptScanPreview {
  return {
    title: scan.merchant || 'Чек проверен',
    caption: 'Данные готовы. Можно создать расход из этого чека.',
    fields: [
      { label: 'Магазин', value: scan.merchant || '—' },
      { label: 'Сумма', value: formatMoney(scan.totalAmount, scan.currency) },
      { label: 'Дата', value: scan.purchasedAt ? new Intl.DateTimeFormat('ru-RU').format(scan.purchasedAt) : '—' },
    ],
  };
}

function buildExpenseCreatedPreview(scan: Pick<ReceiptScan, 'merchant' | 'totalAmount' | 'currency' | 'purchasedAt'>, transactionId: string): ReceiptScanPreview {
  return {
    title: scan.merchant || 'Расход создан',
    caption: 'Расход создан из чека. Чек сохранён в истории.',
    fields: [
      { label: 'Сумма', value: formatMoney(scan.totalAmount, scan.currency) },
      { label: 'Операция', value: transactionId },
    ],
  };
}

const transactionService = new TransactionService();

export class ReceiptScanService {
  async list(userId: string): Promise<ReceiptScanDto[]> {
    const scans = await prisma.receiptScan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return scans.map(toDto);
  }

  async create(userId: string, input: CreateReceiptInput): Promise<{ scan: ReceiptScanDto; subscription: Awaited<ReturnType<typeof subscriptionService.getStatus>> }> {
    const mimeType = input.mimeType.toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestError('Unsupported receipt file type', { mimeType });
    }
    if (input.sizeBytes <= 0) {
      throw new BadRequestError('Receipt file is empty');
    }
    if (input.sizeBytes > MAX_RECEIPT_FILE_BYTES) {
      throw new BadRequestError('Receipt file is too large', { maxBytes: MAX_RECEIPT_FILE_BYTES });
    }

    const access = await subscriptionService.getFeatureAccess(userId, 'receiptScan');
    const usage = access.usage.receiptScansThisMonth;
    if (!access.allowed || usage.remaining <= 0) {
      throw new ForbiddenError('Receipt scan limit reached', {
        feature: 'receiptScan',
        used: usage.used,
        limit: usage.limit,
      });
    }

    const fileName = normalizeFileName(input.fileName);
    const preview = buildPreview({ ...input, fileName, mimeType });
    const scan = await prisma.receiptScan.create({
      data: {
        userId,
        fileName,
        mimeType,
        sizeBytes: input.sizeBytes,
        status: 'uploaded',
        preview: JSON.stringify(preview),
      },
    });

    const subscription = await subscriptionService.recordUsage(userId, 'receiptScans', {
      receiptScanId: scan.id,
      sizeBytes: input.sizeBytes,
      mimeType,
    });

    return { scan: toDto(scan), subscription };
  }

  async get(userId: string, receiptScanId: string): Promise<ReceiptScanDto> {
    const scan = await prisma.receiptScan.findFirst({ where: { id: receiptScanId, userId } });
    if (!scan) throw new NotFoundError('Receipt scan not found');
    return toDto(scan);
  }

  async review(userId: string, receiptScanId: string, input: ReviewReceiptInput): Promise<ReceiptScanDto> {
    const existing = await prisma.receiptScan.findFirst({ where: { id: receiptScanId, userId } });
    if (!existing) throw new NotFoundError('Receipt scan not found');

    const merchant = normalizeOptionalString(input.merchant, 120);
    const totalAmount = normalizeMoney(input.totalAmount);
    const currency = normalizeCurrency(input.currency);
    const purchasedAt = normalizeDate(input.purchasedAt);
    const rawText = normalizeOptionalString(input.rawText, 5000);

    const draft = {
      merchant: merchant !== undefined ? merchant : existing.merchant,
      totalAmount: totalAmount !== undefined ? totalAmount : existing.totalAmount,
      currency: currency !== undefined ? currency : existing.currency,
      purchasedAt: purchasedAt !== undefined ? purchasedAt : existing.purchasedAt,
    };

    const updated = await prisma.receiptScan.update({
      where: { id: existing.id },
      data: {
        ...(merchant !== undefined ? { merchant } : {}),
        ...(totalAmount !== undefined ? { totalAmount } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(purchasedAt !== undefined ? { purchasedAt } : {}),
        ...(rawText !== undefined ? { rawText } : {}),
        status: 'reviewed',
        preview: JSON.stringify(buildReviewedPreview(draft)),
      },
    });

    return toDto(updated);
  }

  async createExpense(userId: string, receiptScanId: string, input: CreateExpenseFromReceiptInput) {
    const scan = await prisma.receiptScan.findFirst({ where: { id: receiptScanId, userId } });
    if (!scan) throw new NotFoundError('Receipt scan not found');

    const accountId = normalizeRequiredString(input.accountId, 'accountId');
    const amount = normalizeMoney(input.amount) ?? scan.totalAmount;
    if (!amount || amount <= 0) throw new BadRequestError('Receipt amount is required before creating expense');

    const title = normalizeOptionalString(input.title, 160) ?? scan.merchant ?? 'Расход по чеку';
    const description = normalizeOptionalString(input.description, 500) ?? `Чек: ${scan.fileName}`;
    const date = normalizeDate(input.date) ?? scan.purchasedAt ?? new Date();
    const categoryId = normalizeOptionalString(input.categoryId, 80) ?? null;
    const sectionId = normalizeOptionalString(input.sectionId, 80) ?? null;

    const transaction = await transactionService.createTransaction(userId, {
      accountId,
      categoryId,
      sectionId,
      amount,
      type: 'expense',
      title,
      description,
      date,
      isAIGenerated: false,
    });

    const updated = await prisma.receiptScan.update({
      where: { id: scan.id },
      data: {
        status: 'expense_created',
        totalAmount: scan.totalAmount ?? amount,
        merchant: scan.merchant ?? title,
        purchasedAt: scan.purchasedAt ?? date,
        preview: JSON.stringify(buildExpenseCreatedPreview({ ...scan, totalAmount: scan.totalAmount ?? amount, merchant: scan.merchant ?? title, purchasedAt: scan.purchasedAt ?? date }, transaction.id)),
      },
    });

    return { scan: toDto(updated), transaction };
  }
}

export const receiptScanService = new ReceiptScanService();
