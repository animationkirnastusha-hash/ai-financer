import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { receiptScanService } from './service';

const MAX_RECEIPT_UPLOAD_BYTES = 20 * 1024 * 1024;

export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_UPLOAD_BYTES, files: 1 },
});

export function receiptUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  receiptUpload.single('receipt')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(new BadRequestError('Receipt file is too large', { maxBytes: MAX_RECEIPT_UPLOAD_BYTES }));
        return;
      }
      next(new BadRequestError('Receipt upload failed', { code: error.code }));
      return;
    }

    next(error);
  });
}

type ReceiptUploadRequest = Request & { file?: Express.Multer.File };

function requireUserId(req: Request): string {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
}

function getReceiptScanId(req: Request): string {
  const receiptScanId = typeof req.params.receiptScanId === 'string' ? req.params.receiptScanId : '';
  if (!receiptScanId) throw new BadRequestError('Receipt scan is required');
  return receiptScanId;
}

function parseOptionalDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid receipt date');
  return date;
}

function normalizeReceiptBody(body: Record<string, unknown>) {
  return {
    merchant: body.merchant as string | null | undefined,
    totalAmount: body.totalAmount !== undefined ? Number(body.totalAmount) : undefined,
    currency: body.currency as string | null | undefined,
    purchasedAt: parseOptionalDate(body.purchasedAt),
    accountId: body.accountId as string | null | undefined,
    categoryId: body.categoryId as string | null | undefined,
    rawText: body.rawText as string | null | undefined,
    title: body.title as string | null | undefined,
    description: body.description as string | null | undefined,
  };
}

export const listReceiptScans = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json({ items: await receiptScanService.list(userId) });
});

export const uploadReceiptScan = asyncHandler(async (req: ReceiptUploadRequest, res: Response) => {
  const userId = requireUserId(req);
  const file = req.file;
  if (!file) throw new BadRequestError('Receipt file is required');

  const result = await receiptScanService.create(userId, {
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    buffer: file.buffer,
  });

  res.status(201).json(result);
});

export const getReceiptScan = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json(await receiptScanService.get(userId, getReceiptScanId(req)));
});

export const reviewReceiptScan = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const scan = await receiptScanService.review(userId, getReceiptScanId(req), normalizeReceiptBody(req.body ?? {}));
  res.json({ scan });
});

export const createReceiptExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await receiptScanService.createExpense(userId, getReceiptScanId(req), normalizeReceiptBody(req.body ?? {}));
  res.json(result);
});
