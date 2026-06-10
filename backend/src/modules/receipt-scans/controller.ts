import multer from 'multer';
import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { receiptScanService } from './service';

export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

type ReceiptUploadRequest = Request & { file?: Express.Multer.File };

function requireUserId(req: Request): string {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
}

function readReceiptScanId(req: Request): string {
  const raw = req.params.receiptScanId;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.trim()) throw new BadRequestError('Receipt scan is required');
  return value.trim();
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
  });

  res.status(201).json(result);
});

export const getReceiptScan = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json(await receiptScanService.get(userId, readReceiptScanId(req)));
});

export const reviewReceiptScan = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json({ scan: await receiptScanService.review(userId, readReceiptScanId(req), req.body ?? {}) });
});

export const createExpenseFromReceiptScan = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.status(201).json(await receiptScanService.createExpense(userId, readReceiptScanId(req), req.body ?? {}));
});
