import type { ReceiptScan } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import { subscriptionService } from '../subscription/service';
import { TransactionService } from '../transactions/service';
import { buildReceiptItemsDescription, buildReceiptTaxonomyItems, groupReceiptTaxonomyItems, type ReceiptTaxonomyGroup } from '../taxonomy/receipt-taxonomy';
import { receiptAiService, type ReceiptAiResult } from './receipt-ai.service';

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
  accountId: string | null;
  categoryId: string | null;
  transactionId: string | null;
  preview: ReceiptScanPreview | null;
  createdAt: string;
  updatedAt: string;
};

type ReceiptScanPreview = {
  title: string;
  caption: string;
  fields: Array<{ label: string; value: string }>;
  groups?: ReceiptTaxonomyGroup[];
};

type CreateReceiptInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer?: Buffer;
};

export type ReviewReceiptInput = {
  merchant?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  purchasedAt?: Date | null;
  accountId?: string | null;
  categoryId?: string | null;
  rawText?: string | null;
};

export type CreateExpenseFromReceiptInput = ReviewReceiptInput & {
  title?: string | null;
  description?: string | null;
};

const MAX_RECEIPT_FILE_BYTES = 20 * 1024 * 1024;
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

function normalizeOptionalText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeAmount(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError('Receipt amount must be greater than 0');
  return amount;
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
    accountId: scan.accountId,
    categoryId: scan.categoryId,
    transactionId: scan.transactionId,
    preview: parsePreview(scan.preview),
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}

function formatReceiptDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : 'Не найдена';
}

function buildUploadPreview(input: CreateReceiptInput): ReceiptScanPreview {
  const kb = Math.max(1, Math.round(input.sizeBytes / 1024));
  return {
    title: 'Чек загружен',
    caption: receiptAiService.canAnalyze(input.mimeType)
      ? 'Фина не смогла уверенно прочитать чек. Проверь данные вручную.'
      : 'Формат сохранён в истории. Проверь данные вручную перед созданием расхода.',
    fields: [
      { label: 'Файл', value: input.fileName },
      { label: 'Размер', value: `${kb} КБ` },
      { label: 'Статус', value: 'Нужна ручная проверка' },
    ],
  };
}

function buildAnalyzedPreview(analysis: ReceiptAiResult): ReceiptScanPreview {
  const groups = groupReceiptTaxonomyItems(buildReceiptTaxonomyItems(analysis.rawText));
  const fields = [
    { label: 'Магазин', value: analysis.merchant || 'Не найден' },
    { label: 'Сумма', value: analysis.totalAmount ? `${analysis.totalAmount} ${analysis.currency}` : 'Не найдена' },
    { label: 'Дата', value: formatReceiptDate(analysis.purchasedAt) },
    { label: 'Позиции', value: analysis.items.length ? `${analysis.items.length}` : 'Не найдены' },
    { label: 'Уверенность', value: `${Math.round(analysis.confidence * 100)}%` },
  ];

  return {
    title: analysis.merchant || 'Чек разобран',
    caption: groups.length > 0
      ? 'Фина прочитала чек и разложила позиции по смыслу. Проверь итог, счёт и категории.'
      : 'Фина прочитала основные данные. Проверь сумму, счёт и категорию.',
    fields,
    ...(groups.length > 0 ? { groups } : {}),
  };
}

function buildReviewedPreview(scan: ReceiptScan): ReceiptScanPreview {
  const items = buildReceiptTaxonomyItems(scan.rawText);
  const groups = groupReceiptTaxonomyItems(items);
  return {
    title: scan.merchant || 'Чек проверен',
    caption: scan.transactionId
      ? 'Расход уже создан.'
      : groups.length > 0
        ? 'Проверь сумму, счёт и данные чека перед созданием расхода.'
        : 'Можно создать расход из этого чека.',
    fields: [
      { label: 'Сумма', value: scan.totalAmount ? `${scan.totalAmount} ${scan.currency}` : 'Не указана' },
      { label: 'Дата', value: scan.purchasedAt ? scan.purchasedAt.toISOString().slice(0, 10) : 'Не указана' },
      { label: 'Статус', value: scan.transactionId ? 'Расход создан' : 'Проверен' },
    ],
    ...(groups.length > 0 ? { groups } : {}),
  };
}

export class ReceiptScanService {
  private transactionService = new TransactionService();

  async list(userId: string): Promise<ReceiptScanDto[]> {
    const scans = await prisma.receiptScan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
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
    const packageUsage = access.packageCredits.receiptScans;
    if (!access.allowed || (usage.remaining <= 0 && packageUsage.remaining <= 0)) {
      throw new ForbiddenError('Receipt scan limit reached', {
        feature: 'receiptScan',
        used: usage.used,
        limit: usage.limit,
        packageRemaining: packageUsage.remaining,
      });
    }

    const fileName = normalizeFileName(input.fileName);
    const normalizedInput = { ...input, fileName, mimeType };
    const analysis = input.buffer
      ? await receiptAiService.analyze({ buffer: input.buffer, mimeType, fileName })
      : null;
    const preview = analysis
      ? buildAnalyzedPreview(analysis)
      : buildUploadPreview(normalizedInput);

    const scan = await prisma.receiptScan.create({
      data: {
        userId,
        fileName,
        mimeType,
        sizeBytes: input.sizeBytes,
        status: analysis ? 'reviewed' : 'uploaded',
        merchant: analysis?.merchant ?? undefined,
        totalAmount: analysis?.totalAmount ?? undefined,
        currency: analysis?.currency ?? 'RUB',
        purchasedAt: analysis?.purchasedAt ?? undefined,
        rawText: analysis?.rawText ?? undefined,
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

    const data = await this.buildReviewData(userId, input);
    const updated = await prisma.receiptScan.update({
      where: { id: receiptScanId },
      data: {
        ...data,
        status: existing.transactionId ? 'expense_created' : 'reviewed',
      },
    });

    const preview = buildReviewedPreview(updated);
    const withPreview = await prisma.receiptScan.update({
      where: { id: receiptScanId },
      data: { preview: JSON.stringify(preview) },
    });

    return toDto(withPreview);
  }

  async createExpense(userId: string, receiptScanId: string, input: CreateExpenseFromReceiptInput): Promise<{ scan: ReceiptScanDto; transactionId: string }> {
    const reviewed = await this.review(userId, receiptScanId, input);
    if (reviewed.transactionId) {
      return { scan: reviewed, transactionId: reviewed.transactionId };
    }

    if (!reviewed.accountId) throw new BadRequestError('Account is required to create expense from receipt');
    if (!reviewed.totalAmount) throw new BadRequestError('Receipt amount is required to create expense');

    const receiptTitle = input.title?.trim()
      || 'Покупка по чеку';
    const sourceScan = await prisma.receiptScan.findFirst({ where: { id: receiptScanId, userId } });
    const itemsDescription = buildReceiptItemsDescription(sourceScan?.rawText);
    const receiptDescription = input.description?.trim()
      || [
        `Расход из чека ${reviewed.fileName}`,
        reviewed.merchant ? `Место: ${reviewed.merchant}` : '',
        itemsDescription,
      ].filter(Boolean).join(' · ');

    const transaction = await this.transactionService.createTransaction(userId, {
      accountId: reviewed.accountId,
      categoryId: reviewed.categoryId,
      amount: reviewed.totalAmount,
      type: 'expense',
      title: receiptTitle,
      description: receiptDescription,
      date: reviewed.purchasedAt ? new Date(reviewed.purchasedAt) : new Date(),
      isAIGenerated: false,
    });

    const updated = await prisma.receiptScan.update({
      where: { id: receiptScanId },
      data: {
        transactionId: transaction.id,
        status: 'expense_created',
      },
    });

    const preview = buildReviewedPreview(updated);
    const withPreview = await prisma.receiptScan.update({
      where: { id: receiptScanId },
      data: { preview: JSON.stringify(preview) },
    });

    return { scan: toDto(withPreview), transactionId: transaction.id };
  }

  private async buildReviewData(userId: string, input: ReviewReceiptInput) {
    const accountId = input.accountId === undefined ? undefined : await this.resolveAccountId(userId, input.accountId);
    const categoryId = input.categoryId === undefined ? undefined : await this.resolveCategoryId(userId, input.categoryId);

    return {
      ...(input.merchant !== undefined ? { merchant: normalizeOptionalText(input.merchant) } : {}),
      ...(input.totalAmount !== undefined ? { totalAmount: normalizeAmount(input.totalAmount) } : {}),
      ...(input.currency !== undefined ? { currency: String(input.currency || 'RUB').trim().toUpperCase() } : {}),
      ...(input.purchasedAt !== undefined ? { purchasedAt: input.purchasedAt } : {}),
      ...(input.rawText !== undefined ? { rawText: normalizeOptionalText(input.rawText) } : {}),
      ...(accountId !== undefined ? { accountId } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
    };
  }

  private async resolveAccountId(userId: string, accountId: string | null | undefined) {
    if (!accountId) return null;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
    if (!account) throw new NotFoundError('Account not found');
    return account.id;
  }

  private async resolveCategoryId(userId: string, categoryId: string | null | undefined) {
    if (!categoryId) return null;
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { id: true, type: true } });
    if (!category) throw new NotFoundError('Category not found');
    if (category.type !== 'expense') throw new BadRequestError('Receipt category must be an expense category');
    return category.id;
  }
}

export const receiptScanService = new ReceiptScanService();
