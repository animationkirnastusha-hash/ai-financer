import type { ReceiptScan } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import { subscriptionService } from '../subscription/service';

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
    caption: 'Фина сохранила чек. Разбор суммы и категорий появится здесь.',
    fields: [
      { label: 'Файл', value: input.fileName },
      { label: 'Размер', value: `${kb} КБ` },
      { label: 'Статус', value: 'Ожидает разбора' },
    ],
  };
}

export class ReceiptScanService {
  async list(userId: string): Promise<ReceiptScanDto[]> {
    const scans = await prisma.receiptScan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
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
}

export const receiptScanService = new ReceiptScanService();
